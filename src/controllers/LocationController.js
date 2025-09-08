import { LocationModel } from "../models/LocationModel.js";

const addLocation = async (req, res) => {
  try {

//  return res.status(200).send({
//       message: "successssss test",
//       data:req.body
//     });
  
    const {
      lt_user_id,
      lt_name,
      lt_latitude,
      lt_longitude,
      lt_app_time,
      lt_isInternetOn_Off,
      lt_locationOn_off,
      lt_location_permission,
    } = req.body;

    // create new location document
    const result = new LocationModel({
      lt_user_id,
      lt_name,
      lt_latitude,
      lt_longitude,
      lt_app_time,
      lt_isInternetOn_Off,
      lt_locationOn_off,
      lt_location_permission,
    });

    const data = await result.save();
    console.log(data);


    if (data) {
      return res.status(201).send({
        product: data,
        message: "Location added successfully",
        status: 201,
      });
    }
  } catch (err) {
    return res.status(500).send({
      message: err.message || "Internal Server Error",
      status: 500,
    });
  }
};

export { addLocation };
