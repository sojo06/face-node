import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const FLASK_API_URL = process.env.FLASK_API_URL;


export const verifyFace = async ({ base64Image, modelPath }) => {
  const response = await axios.post(`${FLASK_API_URL}/verify`, {
    image: base64Image,
    modelPath
  });
  return response.data.verifiedStudents || [];
};
export const trainModel = async ({ modelName, data }) => {
  const response = await axios.post(`${FLASK_API_URL}/train`, {
    modelName,
    data
  });
  return response.data;
};