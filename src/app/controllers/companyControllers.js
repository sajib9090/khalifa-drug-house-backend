import { ObjectId } from "mongodb";
import { validateString } from "../utils/validateString.js";
import createError from "http-errors";
import { companiesCollection } from "../collections/collections.js";

export const handleCreateCompany = async (req, res, next) => {
  const { company_name } = req.body;
  const user = req.user.user ? req.user.user : req.user;

  try {
    if (!company_name) {
      throw createError(
        400,
        "Company name is required. Please provide a valid group title."
      );
    }
    const processedCompanyName = validateString(
      company_name,
      "Company Name",
      1,
      300
    );

    const existingCompanyName = await companiesCollection.findOne({
      $and: [
        { pharmacy_id: user?.pharmacy_id },
        { company_name: processedCompanyName },
      ],
    });

    if (existingCompanyName) {
      throw createError(400, "Company name already exist");
    }

    const newCompany = {
      company_name: processedCompanyName,
      pharmacy_id: user?.pharmacy_id,
      createdAt: new Date(),
    };

    const result = await companiesCollection.insertOne(newCompany);

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

export const handleGetCompanies = async (req, res, next) => {
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
        $or: [{ company_name: regExSearch }],
      };
    } else {
      query = { pharmacy_id: user?.pharmacy_id };
    }

    let sortCriteria = { company_name: 1 };

    let companies;

    const findQuery = companiesCollection.find(query).sort(sortCriteria);

    if (limit) {
      findQuery.limit(limit).skip((page - 1) * limit);
    }

    companies = await findQuery.toArray();

    const count = await companiesCollection.countDocuments(query);

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
      data: companies,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteCompany = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const result = await companiesCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result?.deletedCount === 0) {
      throw createError(404, "Company not found");
    }
    res.status(200).send({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
