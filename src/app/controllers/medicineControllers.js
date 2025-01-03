import { ObjectId } from "mongodb";
import { validateString } from "../utils/validateString.js";
import createError from "http-errors";
import { medicinesCollection } from "../collections/collections.js";

export const handleCreateMedicine = async (req, res, next) => {
  const {
    medicine_name,
    group,
    company,
    strength,
    dosage_form,
    purchase_price,
    sell_price,
    category,
  } = req.body;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!["medicine", "other"].includes(category)) {
      throw createError(
        400,
        'Category is required and must be either "medicine" or "other".'
      );
    }
    if (!medicine_name) {
      throw createError(
        400,
        "Medicine name is required. Please provide a valid medicine name."
      );
    }
    if (!group) {
      throw createError(400, "Group is required.");
    }
    if (!company) {
      throw createError(400, "Company/Supplier is required.");
    }
    if (!strength) {
      throw createError(400, "Strength/Weight is required.");
    }
    if (!dosage_form) {
      throw createError(400, "Dosage form is required.");
    }
    if (purchase_price === undefined) {
      throw createError(400, "Purchase Price is required.");
    }
    if (sell_price === undefined) {
      throw createError(400, "Sell Price is required.");
    }

    const parsedPurchasePrice =
      typeof purchase_price === "string"
        ? parseFloat(purchase_price)
        : purchase_price;
    const parsedSellPrice =
      typeof sell_price === "string" ? parseFloat(sell_price) : sell_price;

    if (isNaN(parsedPurchasePrice)) {
      throw createError(400, "Purchase Price must be a valid number.");
    }
    if (isNaN(parsedSellPrice)) {
      throw createError(400, "Sell Price must be a valid number.");
    }

    if (parsedPurchasePrice > parsedSellPrice) {
      throw createError(
        400,
        "Purchase Price cannot be greater than Sell Price."
      );
    }
    const processedMedicineName = validateString(
      medicine_name,
      "Medicine Name",
      1,
      500
    );

    const existingMedicine = await medicinesCollection.findOne({
      $and: [
        { pharmacy_id: user?.pharmacy_id },
        { medicine_name: processedMedicineName },
        { dosage_form: dosage_form },
        { strength: strength },
      ],
    });

    if (existingMedicine) {
      throw createError(400, "Medicine already exist");
    }

    const newMedicine = {
      medicine_title: dosage_form + " " + medicine_name + " " + strength,
      medicine_name: processedMedicineName,
      pharmacy_id: user?.pharmacy_id,
      strength: strength,
      dosage_form: dosage_form,
      company: company,
      purchase_price: parsedPurchasePrice,
      sell_price: parsedSellPrice,
      stock: 0,
      group: group,
      category: category,
      createdAt: new Date(),
    };

    const result = await medicinesCollection.insertOne(newMedicine);

    if (!result?.insertedId) {
      throw createError(500, "Something went wrong. Try again");
    }

    res.status(200).send({
      success: true,
      message: "Medicine created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetMedicines = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const search = req.query.search || "";
  const page = Number(req.query.page) || 1;
  const limit = req.query.limit ? Number(req.query.limit) : null;
  const sortPrice = req.query.sortPrice || "";
  const stockLeft = req.query.stockLeft || "";
  const company = req.query.company || "";
  const group = req.query.group || "";
  const category = req.query.category || "";

  try {
    const regExSearch = new RegExp(".*" + search + ".*", "i");

    let query;

    if (search) {
      query = {
        $and: [
          {
            pharmacy_id: user?.pharmacy_id,
          },
        ],
        $or: [{ medicine_title: regExSearch }],
      };
    } else {
      query = { pharmacy_id: user?.pharmacy_id };
    }

    if (company) {
      query.company = company;
    }
    if (group) {
      query.group = group;
    }
    if (category) {
      query.category = category;
    }

    let sortCriteria = { medicine_name: 1 };
    if (sortPrice === "high") {
      sortCriteria = { sell_price: -1 };
    } else if (sortPrice === "low") {
      sortCriteria = { sell_price: 1 };
    }

    if (stockLeft === "high") {
      sortCriteria = { stock: -1 };
    } else if (stockLeft === "low") {
      sortCriteria = { stock: 1 };
    }

    let medicines;

    const findQuery = medicinesCollection.find(query).sort(sortCriteria);

    if (limit) {
      findQuery.limit(limit).skip((page - 1) * limit);
    }

    medicines = await findQuery.toArray();

    const count = await medicinesCollection.countDocuments(query);
    const all = await medicinesCollection.find(query).toArray();

    let totalSellValue = 0;
    let totalPurchaseValue = 0;

    all?.forEach((medicine) => {
      totalSellValue += medicine?.stock * medicine?.sell_price;
      totalPurchaseValue += medicine?.stock * medicine?.purchase_price;
    });

    res.status(200).send({
      success: true,
      message: "Data retrieved successfully",
      data_found: count,
      total_purchase_value: totalPurchaseValue,
      total_sales_value: totalSellValue,
      pagination: limit
        ? {
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            previousPage: page - 1 > 0 ? page - 1 : null,
            nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
          }
        : null,
      data: medicines,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetMedicineById = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const existingItem = await medicinesCollection.findOne({
      $and: [{ _id: new ObjectId(id) }, { pharmacy_id: user?.pharmacy_id }],
    });

    if (!existingItem) {
      throw createError(404, "Item not found");
    }
    res.status(200).send({
      success: true,
      message: "Medicine retrieved successfully",
      data: existingItem,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteMedicine = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const result = await medicinesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result?.deletedCount === 0) {
      throw createError(404, "Medicine not found");
    }
    res.status(200).send({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
