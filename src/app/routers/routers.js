import express from "express";
import {
  handleLoginUser,
  handleRefreshToken,
  handleRegisterUser,
} from "../controllers/userControllers.js";
import { isLoggedIn, isSuperAdmin } from "../middlewares/authUser.js";
import {
  handleCreateDosageForm,
  handleDeleteDosageForm,
  handleGetDosageForm,
  handleGetDosageForms,
} from "../controllers/dosageFormControllers.js";
import {
  handleCreateGroup,
  handleDeleteGroup,
  handleGetGroups,
} from "../controllers/groupControllers.js";
import {
  handleCreateCompany,
  handleDeleteCompany,
  handleGetCompanies,
} from "../controllers/companyControllers.js";
import {
  handleCreateMedicine,
  handleDeleteMedicine,
  handleGetMedicineById,
  handleGetMedicines,
} from "../controllers/medicineControllers.js";
import {
  handleCreateSoldInvoice,
  handleGetSingleSoldInvoice,
  handleGetSoldInvoices,
} from "../controllers/soldInvoiceControllers.js";
import {
  handleCreatePurchaseInvoice,
  handleGetPurchaseInvoices,
  handleGetSinglePurchaseInvoice,
} from "../controllers/purchaseControllers.js";
import {
  handleAddExpense,
  handleGetExpensesByDate,
} from "../controllers/expenseController.js";

export const apiRouter = express.Router();

apiRouter.post(
  "/users/register-user",
  isLoggedIn,
  isSuperAdmin,
  handleRegisterUser
);
apiRouter.post("/users/auth-user-login", handleLoginUser);
apiRouter.get("/users/auth-manage-token", handleRefreshToken);

//dosage form
apiRouter.post(
  "/dosage-forms/dosage-form-create",
  isLoggedIn,
  handleCreateDosageForm
);
apiRouter.get(
  "/dosage-forms/find-dosage-form/:id",
  isLoggedIn,
  handleGetDosageForm
);
apiRouter.get("/dosage-forms", isLoggedIn, handleGetDosageForms);
apiRouter.delete(
  "/dosage-forms/delete/:id",
  isLoggedIn,
  handleDeleteDosageForm
);

//groups
apiRouter.post("/groups/group-create", isLoggedIn, handleCreateGroup);
apiRouter.get("/groups", isLoggedIn, handleGetGroups);
apiRouter.delete("/groups/delete/:id", isLoggedIn, handleDeleteGroup);

//companies
apiRouter.post("/companies/company-create", isLoggedIn, handleCreateCompany);
apiRouter.get("/companies", isLoggedIn, handleGetCompanies);
apiRouter.delete("/companies/delete/:id", isLoggedIn, handleDeleteCompany);

//medicines
apiRouter.post("/medicines/medicine-create", isLoggedIn, handleCreateMedicine);
apiRouter.get("/medicines", isLoggedIn, handleGetMedicines);
apiRouter.get("/medicines/get-medicine/:id", isLoggedIn, handleGetMedicineById);
apiRouter.delete("/medicines/delete/:id", isLoggedIn, handleDeleteMedicine);

//sold invoices
apiRouter.post(
  "/sold-invoices/invoice-create",
  isLoggedIn,
  handleCreateSoldInvoice
);
apiRouter.get(
  "/sold-invoices/get-single/:id",
  isLoggedIn,
  handleGetSingleSoldInvoice
);
apiRouter.get("/sold-invoices", isLoggedIn, handleGetSoldInvoices);

//purchase
apiRouter.post(
  "/purchase-invoices/invoice-create",
  isLoggedIn,
  handleCreatePurchaseInvoice
);
apiRouter.get(
  "/purchase-invoices/get-single/:id",
  isLoggedIn,
  handleGetSinglePurchaseInvoice
);
apiRouter.get("/purchase-invoices", isLoggedIn, handleGetPurchaseInvoices);

//expense
apiRouter.post("/expenses/expense-create", isLoggedIn, handleAddExpense);
apiRouter.get("/expenses", isLoggedIn, handleGetExpensesByDate);
