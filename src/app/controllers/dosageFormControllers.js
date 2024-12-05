import createError from "http-errors";
import { ObjectId } from "mongodb";
import { dosageFormsCollection } from "../collections/collections.js";
import { validateString } from "../utils/validateString.js";

export const handleCreateDosageForm = async (req, res, next) => {
  const { dosage_form } = req.body;
  const user = req.user.user ? req.user.user : req.user;

  try {
    if (!dosage_form) {
      throw createError(
        400,
        "Dosage form is required. Please provide a valid dosage form."
      );
    }
    const processedDosageForm = validateString(
      dosage_form,
      "Dosage Form",
      1,
      30
    );

    const existingDosageForm = await dosageFormsCollection.findOne({
      $and: [
        { pharmacy_id: user?.pharmacy_id },
        { dosage_form: processedDosageForm },
      ],
    });

    if (existingDosageForm) {
      throw createError(400, "Dosage form already exist");
    }

    const newDosageForm = {
      dosage_form: processedDosageForm,
      pharmacy_id: user?.pharmacy_id,
      createdAt: new Date(),
    };

    const result = await dosageFormsCollection.insertOne(newDosageForm);

    if (!result?.insertedId) {
      throw createError(500, "Something went wrong. Try again");
    }

    res.status(200).send({
      success: true,
      message: "Created Successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetDosageForm = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }
    const dosageForm = await dosageFormsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!dosageForm) {
      throw createError(404, "Not found");
    }
    res.status(200).send({
      success: true,
      message: "Data retrieved successfully",
      data: dosageForm,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetDosageForms = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const search = req.query.search || "";
  const page = Number(req.query.page) || 1;
  const limit = req.query.limit ? Number(req.query.limit) : null;

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
        $or: [{ dosage_form: regExSearch }],
      };
    } else {
      query = { pharmacy_id: user?.pharmacy_id };
    }

    let sortCriteria = { dosage_form: 1 };

    let dosageForms;

    const findQuery = dosageFormsCollection.find(query).sort(sortCriteria);

    if (limit) {
      findQuery.limit(limit).skip((page - 1) * limit);
    }

    dosageForms = await findQuery.toArray();

    const count = await dosageFormsCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Data retrieved successfully",
      data_found: count,
      pagination: limit
        ? {
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            previousPage: page - 1 > 0 ? page - 1 : null,
            nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
          }
        : null,
      data: dosageForms,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteDosageForm = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const result = await dosageFormsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result?.deletedCount === 0) {
      throw createError(404, "Dosage form not found");
    }
    res.status(200).send({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
