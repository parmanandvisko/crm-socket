
import { Router } from "express";
import { addLocation } from "../controllers/LocationController.js";

const userRoutes = Router();

userRoutes.post("/add-location", addLocation);

export { userRoutes }; 
