import { ObjectId } from "mongodb";
import { groupsCollection } from "../collections/collections.js";
import { validateString } from "../utils/validateString.js";
import createError from "http-errors";

export const handleCreateGroup = async (req, res, next) => {
  const { group_title } = req.body;
  const user = req.user.user ? req.user.user : req.user;

  try {
    if (!group_title) {
      throw createError(
        400,
        "Group title form is required. Please provide a valid group title."
      );
    }
    const processedGroupTitle = validateString(
      group_title,
      "Group Title",
      1,
      300
    );

    const existingGroupTitle = await groupsCollection.findOne({
      $and: [
        { pharmacy_id: user?.pharmacy_id },
        { group_title: processedGroupTitle },
      ],
    });

    if (existingGroupTitle) {
      throw createError(400, "Group name already exist");
    }

    const newGroup = {
      group_title: processedGroupTitle,
      pharmacy_id: user?.pharmacy_id,
      createdAt: new Date(),
    };

    const result = await groupsCollection.insertOne(newGroup);

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

export const handleGetGroups = async (req, res, next) => {
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
        $or: [{ group_title: regExSearch }],
      };
    } else {
      query = { pharmacy_id: user?.pharmacy_id };
    }

    let sortCriteria = { group_title: 1 };

    let groups;

    const findQuery = groupsCollection.find(query).sort(sortCriteria);

    if (limit) {
      findQuery.limit(limit).skip((page - 1) * limit);
    }

    groups = await findQuery.toArray();

    const count = await groupsCollection.countDocuments(query);

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
      data: groups,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteGroup = async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const result = await groupsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result?.deletedCount === 0) {
      throw createError(404, "Group not found");
    }
    res.status(200).send({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
