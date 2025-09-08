import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    lt_user_id: {
      type: Number,
      required: true,
    },
    lt_name: {
      type: String,
      required: true,
    },
    lt_latitude: {
      type: Number,
      required: true,
    },
    lt_longitude: {
      type: Number,
      required: true,
    },
    lt_app_time: {
      type: Number,
      required: true,
    },
    lt_isInternetOn_Off: {
      type: Number,
      required: false,
    },
    lt_locationOn_off: {
      type: Number,
      required: false,
    },
    lt_location_permission: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true }
);

const LocationModel = mongoose.model("location_tracker", locationSchema);

export { LocationModel };
