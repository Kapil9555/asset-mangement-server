// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import connectDB from './src/config/db.js';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFound } from './src/middlewares/errorMiddleware.js';

import productRoutes from "./src/routes/productRoutes.js"
import rentedRoutes from "./src/routes/rentedRoutes.js"
import uploadRoutes from './src/routes/uploadsRoutes.js'
import dashboardRoutes from './src/routes/dashboardRoutes.js'
import financeRoutes from './src/routes/financeRoutes.js'
import customerRoutes from './src/routes/customerRoutes.js'
import authRoutes from './src/routes/authRoutes.js'
import userRoutes from './src/routes/userRoutes.js'




// Load env variables
dotenv.config();

// Connect MongoDB
connectDB();

// Init Express App
const app = express();

// console.log("process.env.CLIENT_URL", process.env.CLIENT_URL)
// Global Middlewares

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));


app.use('/api/uploads', uploadRoutes);
app.use("/api/products", productRoutes);
app.use("/api/rented-products", rentedRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);


// Swagger setup
const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// Root Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// 404 Handler
app.use(notFound);

// Error Handler
app.use(errorHandler);


// Start Server
const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
});
