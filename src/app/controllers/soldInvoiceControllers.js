import { ObjectId } from "mongodb";
import {
  medicinesCollection,
  soldInvoicesCollection,
} from "../collections/collections.js";
import createError from "http-errors";

export const handleCreateSoldInvoice = async (req, res, next) => {
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
    const result = await soldInvoicesCollection.insertOne(newInvoice);

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
          update: { $inc: { stock: -item?.s_quantity } },
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
      await soldInvoicesCollection.deleteOne({ _id: result.insertedId });
      throw createError(
        500,
        "Failed to update stock. Invoice creation rolled back."
      );
    }
  } catch (error) {
    next(error);
  }
};

export const handleGetSingleSoldInvoice = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user.user ? req.user.user : req.user;

  try {
    // Validate if `id` is a valid MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid invoice ID.");
    }
    const objectId = new ObjectId(id);

    // Perform aggregation to lookup `createdBy` information
    const invoiceData = await soldInvoicesCollection
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
            foreignField: "_id", // The field in the users collection
            as: "createdByInfo", // The name of the array with user details
            pipeline: [
              { $project: { _id: 0, email: 1 } }, // Select only specific fields
            ],
          },
        },
        {
          $unwind: {
            path: "$createdByInfo",
            preserveNullAndEmptyArrays: true, // Ensures data is returned even if no user is found
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
      data: invoiceData[0], // Return the first result as `_id` is unique
    });
  } catch (error) {
    next(error);
  }
};
