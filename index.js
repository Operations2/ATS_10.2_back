const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const helmet = require("helmet");
const compression = require("compression");

// Check for required environment variables (only in production)
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please ensure all required environment variables are set in your Vercel deployment.');
    console.error('Continuing with deployment but some features may not work properly.');
  }
}

// Import custom modules
const { createPool, testDatabaseConnection } = require("./config/database");
const AuthController = require("./controllers/authController");
const OrganizationController = require("./controllers/organizationController");
const JobController = require("./controllers/jobController");
const JobSeekerController = require("./controllers/jobSeekerController");
const HiringManagerController = require("./controllers/hiringManagerController");
const CustomFieldController = require("./controllers/customFieldController");
const UserController = require("./controllers/userController");
const LeadController = require("./controllers/leadController");
const TaskController = require("./controllers/taskController");
// NEW IMPORTS
const OfficeController = require("./controllers/officeController");
const TeamController = require("./controllers/teamController");

const createAuthRouter = require("./routes/authRoutes");
const createOrganizationRouter = require("./routes/organizationRoutes");
const createJobRouter = require("./routes/jobRoutes");
const createJobSeekerRouter = require("./routes/jobSeekerRoutes");
const createHiringManagerRouter = require("./routes/hiringManagerRoutes");
const createCustomFieldRouter = require("./routes/customFieldRoutes");
const createUserRouter = require("./routes/userRoutes");
const createLeadRouter = require("./routes/leadRoutes");
const createTaskRouter = require("./routes/taskRoutes");
// NEW ROUTE IMPORTS
const createOfficeRouter = require("./routes/officeRoutes");
const createTeamRouter = require("./routes/teamRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { sanitizeInputs } = require("./middleware/validationMiddleware");
const { verifyToken, checkRole } = require("./middleware/authMiddleware");

const app = express();
const port = process.env.PORT || 8080;

app.use(helmet());
app.use(compression());

const allowedOrigins = [
  'http://localhost:3000',
  'https://ats-orcin.vercel.app',
  'https://ats-software-frontend.vercel.app',
  'https://cms-organization.vercel.app'
];

const additionalOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const allOrigins = [...allowedOrigins, ...additionalOrigins];

try {
  app.use(
    cors({
      origin: process.env.NODE_ENV === "production" ? allOrigins : true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
    })
  );
} catch (error) {
  console.error("CORS configuration error:", error);
  app.use(cors());
}

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

let pool;
const getPool = () => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

const getAuthController = () => new AuthController(getPool());
const getHiringManagerController = () => new HiringManagerController(getPool());
const getOrganizationController = () => new OrganizationController(getPool());
const getJobController = () => new JobController(getPool());
const getUserController = () => new UserController(getPool());
const getJobSeekerController = () => new JobSeekerController(getPool());
const getCustomFieldController = () => new CustomFieldController(getPool());
const getLeadController = () => new LeadController(getPool());
const getTaskController = () => new TaskController(getPool());
const getOfficeController = () => new OfficeController(getPool());
const getTeamController = () => new TeamController(getPool());

app.use(async (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    try {
      const officeController = getOfficeController();
      await officeController.initTables();

      const teamController = getTeamController();
      await teamController.initTables();

      const authController = getAuthController();
      await authController.initTables();

      if (req.path.startsWith("/api/organizations")) {
        await getOrganizationController().initTables();
      }
      if (req.path.startsWith("/api/hiring-managers")) {
        await getHiringManagerController().initTables();
      }
      if (req.path.startsWith("/api/jobs")) {
        await getJobController().initTables();
      }
      if (req.path.startsWith("/api/job-seekers")) {
        await getJobSeekerController().initTables();
      }
      if (req.path.startsWith("/api/custom-fields")) {
        await getCustomFieldController().initTables();
      }
      if (req.path.startsWith("/api/leads")) {
        await getLeadController().initTables();
      }
      if (req.path.startsWith("/api/tasks")) {
        await getTaskController().initTables();
      }
    } catch (error) {
      console.error("Failed to initialize tables:", error.message);
    }
  }
  next();
});

app.use("/api/auth", sanitizeInputs, (req, res, next) => {
  createAuthRouter(getAuthController())(req, res, next);
});

app.use("/api/users", sanitizeInputs, (req, res, next) => {
  createUserRouter(getUserController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/organizations", sanitizeInputs, (req, res, next) => {
  createOrganizationRouter(getOrganizationController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/jobs", sanitizeInputs, (req, res, next) => {
  createJobRouter(getJobController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/job-seekers", sanitizeInputs, (req, res, next) => {
  createJobSeekerRouter(getJobSeekerController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/hiring-managers", sanitizeInputs, (req, res, next) => {
  createHiringManagerRouter(getHiringManagerController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/custom-fields", sanitizeInputs, (req, res, next) => {
  createCustomFieldRouter(getCustomFieldController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/leads", sanitizeInputs, (req, res, next) => {
  createLeadRouter(getLeadController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/tasks", sanitizeInputs, (req, res, next) => {
  createTaskRouter(getTaskController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/offices", sanitizeInputs, (req, res, next) => {
  createOfficeRouter(getOfficeController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.use("/api/teams", sanitizeInputs, (req, res, next) => {
  createTeamRouter(getTeamController(), { verifyToken: verifyToken(getPool()), checkRole })(req, res, next);
});

app.get("/test-db", async (req, res) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NOW()");
      res.json({ success: true, time: result.rows[0].now });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// ✅ ✅ ✅ Add this — root route for Vercel / health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend is live on Vercel!" });
});

app.use(notFound);
app.use(errorHandler);

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
