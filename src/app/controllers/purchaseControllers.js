import { ObjectId } from "mongodb";
import {
  medicinesCollection,
  purchaseCollection,
} from "../collections/collections.js";
import createError from "http-errors";
import validator from "validator";

export const handleCreatePurchaseInvoice = async (req, res, next) => {
  const { total_discount, sub_total_bill, final_bill, items } = req.body;
  const user = req.user.user ? req.user.user : req.user;

  const parseNumber = (value, fieldName) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw createError(400, `${fieldName} must be a valid number.`);
    }
    return num;
  };

  try {
    if (!Array.isArray(items)) {
      throw createError(400, "Items must be an array.");
    }

    if (items.length === 0) {
      throw createError(400, "Items array cannot be empty.");
    }

    const parsedTotalDiscount = parseNumber(total_discount, "Total discount");
    const parsedSubTotalBill = parseNumber(sub_total_bill, "Subtotal");
    const parsedFinalBill = parseNumber(final_bill, "Final bill");

    const newInvoice = {
      pharmacy_id: user?.pharmacy_id,
      total_discount: parsedTotalDiscount,
      sub_total_bill: parsedSubTotalBill,
      final_bill: parsedFinalBill,
      items,
      createdBy: user?._id,
      createdAt: new Date(),
    };

    // Insert the invoice
    const result = await purchaseCollection.insertOne(newInvoice);

    if (!result?.insertedId) {
      throw createError(500, "Failed to create invoice.");
    }

    // Prepare bulk operations for stock update
    const bulkOperations = items?.map((item) => {
      const itemId = ObjectId.isValid(item?._id)
        ? new ObjectId(item._id)
        : item?._id;
      return {
        updateOne: {
          filter: { _id: itemId },
          update: { $inc: { stock: item?.p_quantity } },
        },
      };
    });

    try {
      const bulkResult = await medicinesCollection.bulkWrite(bulkOperations);

      if (bulkResult?.modifiedCount !== items?.length) {
        throw createError(500, "Stock update failed for some items.");
      }

      res.status(200).send({
        success: true,
        message: "Sold successfully",
        data: result?.insertedId,
      });
    } catch (bulkError) {
      // Rollback: delete the invoice if stock update fails
      await purchaseCollection.deleteOne({ _id: result.insertedId });
      throw createError(
        500,
        "Failed to update stock. Invoice creation rolled back."
      );
    }
  } catch (error) {
    next(error);
  }
};

export const handleGetSinglePurchaseInvoice = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user.user ? req.user.user : req.user;

  try {
    // Validate if `id` is a valid MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid invoice ID.");
    }
    const objectId = new ObjectId(id);

    // Perform aggregation to lookup `createdBy` information
    const invoiceData = await purchaseCollection
      .aggregate([
        {
          $match: {
            _id: objectId,
            pharmacy_id: user?.pharmacy_id,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdByInfo",
            pipeline: [{ $project: { _id: 0, email: 1 } }],
          },
        },
        {
          $unwind: {
            path: "$createdByInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .toArray();

    // Check if the invoice was found
    if (!invoiceData || invoiceData.length === 0) {
      throw createError(404, "Invoice not found.");
    }

    res.status(200).send({
      success: true,
      message: "Invoice retrieved successfully",
      data: invoiceData[0],
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetPurchaseInvoices = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { date, start_date, end_date, month } = req.query;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit);

  try {
    // Start with pharmacy_id query
    let query = { pharmacy_id: user?.pharmacy_id };

    // Add date-specific conditions
    if (date) {
      if (!validator.isDate(date, { format: "YYYY-MM-DD", strictMode: true })) {
        throw createError(
          400,
          "Invalid date format. Expected format: YYYY-MM-DD"
        );
      }
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (start_date && end_date) {
      if (
        !validator.isDate(start_date, {
          format: "YYYY-MM-DD",
          strictMode: true,
        })
      ) {
        throw createError(
          400,
          "Invalid start date format. Expected format: YYYY-MM-DD"
        );
      }
      if (
        !validator.isDate(end_date, {
          format: "YYYY-MM-DD",
          strictMode: true,
        })
      ) {
        throw createError(
          400,
          "Invalid end date format. Expected format: YYYY-MM-DD"
        );
      }
      const startOfDay = new Date(start_date);
      const endOfDay = new Date(end_date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (month) {
      if (!validator.isISO8601(month, { strict: true })) {
        throw createError(
          400,
          "Invalid month format. Expected format: YYYY-MM"
        );
      }
      const startOfMonth = new Date(month);
      startOfMonth.setUTCDate(1);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
      endOfMonth.setUTCDate(0);
      endOfMonth.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const purchaseInvoices = await purchaseCollection
      .find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .toArray();

    const count = await purchaseCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Purchase invoices retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < Math.ceil(count / limit) ? page + 1 : null,
      },
      data: purchaseInvoices,
    });
  } catch (error) {
    next(error);
  }
};
