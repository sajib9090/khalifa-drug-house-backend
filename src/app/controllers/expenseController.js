import createError from "http-errors";
import crypto from "crypto";
import { expenseCollection } from "../collections/collections.js";

export const handleAddExpense = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  let { title, total_bill } = req.body;

  try {
    title = title?.trim();
    if (!title) throw createError(400, "Title is required");
    if (!total_bill) throw createError(400, "Total bill is required");

    const numericTotalBill = Number(total_bill);
    if (isNaN(numericTotalBill))
      throw createError(400, "Total bill must be a valid number");

    // Generate unique invoice ID
    const generateCode = crypto.randomBytes(16).toString("hex");
    const newExpense = {
      brand_id: user?.brand_id,
      expense_id: generateCode,
      title: title,
      total_bill: numericTotalBill,
      createdAt: new Date(),
    };

    const result = await expenseCollection.insertOne(newExpense);
    if (!result?.insertedId) throw createError(500, "Expense creation failed");

    res.status(200).send({
      success: true,
      message: "Expense added successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetExpensesByDate = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { date, month, startDate, endDate } = req.query;

  try {
    let query = { brand_id: user?.brand_id };

    if (date) {
      // Parse the date and construct start and end of the day
      const parsedDate = new Date(date);
      if (isNaN(parsedDate)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD.");
      }
      const startOfDay = new Date(parsedDate.setUTCHours(0, 0, 0, 0));
      const endOfDay = new Date(parsedDate.setUTCHours(23, 59, 59, 999));

      // Set query for the day
      query.createdAt = { $gte: startOfDay, $lt: endOfDay };
    }

    if (month) {
      const parsedMonth = new Date(month);
      if (isNaN(parsedMonth)) {
        throw new Error("Invalid month format. Use YYYY-MM.");
      }
      const year = parsedMonth.getUTCFullYear();
      const monthIndex = parsedMonth.getUTCMonth();
      const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(
        Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
      );

      query.createdAt = { $gte: startOfMonth, $lt: endOfMonth };
    }

    // Query for a date range
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date("1970-01-01");
      const end = endDate ? new Date(endDate) : new Date();
      if (isNaN(start) || isNaN(end)) {
        throw new Error("Invalid date range. Use YYYY-MM-DD.");
      }
      if (start > end) {
        throw new Error("Start date cannot be after end date.");
      }
      const startRange = new Date(start.setUTCHours(0, 0, 0, 0));
      const endRange = new Date(end.setUTCHours(23, 59, 59, 999));

      query.createdAt = { $gte: startRange, $lte: endRange };
    }
    // Fetch invoices from the database
    const result = await expenseCollection.find(query).toArray();

    // Respond with data
    res.status(200).send({
      success: true,
      message: "Expenses retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleRemoveExpense = async (req, res, next) => {
  const { expenseId } = req.params;
  const user = req.user.user ? req.user.user : req.user;

  try {
    const existingExpense = await expenseCollection.findOne({
      expense_id: expenseId,
      brand_id: user?.brand_id,
    });

    if (!existingExpense) {
      throw createError(404, "Expense not found");
    }

    const result = await expenseCollection.deleteOne({
      expense_id: expenseId,
      brand_id: user?.brand_id,
    });

    if (result?.deletedCount === 0) {
      throw createError(500, "Something went wrong try again");
    }

    res.status(200).send({
      success: true,
      message: "Expense removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
