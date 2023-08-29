const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (AUTH_TOKEN === undefined) {
  console.error("Please set AUTH_TOKEN environment variable");
  process.exit(1);
}

const app = express();

mongoose
  .connect(process.env.MONGO_DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .catch((e) => {
    console.log("error connecting to mongoose!", e);
  });

const db = mongoose.connection;

// If the connection throws an error
db.on("error", function (err) {
  console.log("Mongoose connection error: " + err);
});

db.once("open", () => {
  console.log("Connected to the database");
});
// When successfully connected
db.on("connected", function () {
  console.log("Mongoose connection open");
});

const projectSchema = new mongoose.Schema(
  {
    title: String,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const fileSchema = new mongoose.Schema(
  {
    //   projectId: String,
    projectId: { type: mongoose.SchemaTypes.ObjectId, ref: "Project" },
    id: String,
    filename: String,
    title: String,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Project = mongoose.model("Project", projectSchema);
const FileEntry = mongoose.model("FileEntry", fileSchema);

// Middleware to check the Authorization header
function checkAuthHeader(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).send("Unauthorized");
  }

  next();
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Apply the checkAuthHeader middleware to all routes
app.use(checkAuthHeader);

const upload = multer({ dest: "uploads/" });

// Create new project
app.post("/projects", async (req, res) => {
  const { title, id } = req.body;
  const project = new Project({ title, id });
  await project.save();
  res.send(project);
});

// Fetch all projects
app.get("/projects", async (req, res) => {
  const projects = await Project.find();
  res.send(projects);
});

// Get project details
app.get("/projects/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the project by its ID
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).send("Project not found");
    }

    res.send(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).send("An error occurred while fetching project");
  }
});

// List files for a project
app.get("/projects/:id/files", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch all file entries for the given project ID
    const files = await FileEntry.find({ projectId: id });

    res.send(files);
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).send("An error occurred while listing files");
  }
});

// Rename project
app.put("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { newTitle } = req.body;

  try {
    const project = await Project.findById(id);

    if (!project) return res.status(404).send("Project not found");

    const oldTitle = project.title;
    project.title = newTitle;

    await project.save();

    // Rename the associated upload subfolder
    const oldDirPath = `uploads/${oldTitle}`;
    const newDirPath = `uploads/${newTitle}`;

    if (fs.existsSync(oldDirPath)) {
      fs.renameSync(oldDirPath, newDirPath);
    }

    res.send(project);
  } catch (error) {
    console.error("Error renaming project:", error);
    res.status(500).send("An error occurred while renaming project");
  }
});

// Delete project
app.delete("/projects/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const project = await Project.findById(id);

    if (!project) return res.status(404).send("Project not found");

    // Delete and rename the associated upload subfolder
    const dirPath = `uploads/${project.title}`;

    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true });
    }

    // Find and delete all files associated with the project
    const filesToDelete = await FileEntry.find({ projectId: id }).exec();

    for (const file of filesToDelete) {
      const filePath = path.join(dirPath, file.id);

      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true });
      }

      // Delete file entry from the database
      await FileEntry.deleteOne({ _id: file._id });
    }

    // Delete the project itself
    await Project.deleteOne({ _id: id });

    res.send("Project and associated files deleted");
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).send("An error occurred while deleting project");
  }
});

const handleFileUploads = async (files, projectId, projectTitle) => {
  const uploadedFiles = [];

  for (const file of files) {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const existingFile = await FileEntry.findOne({ projectId, id: hash });
      if (existingFile) {
        continue; // Skip the file if it already exists
      }

      const fileEntry = new FileEntry({
        projectId,
        id: hash,
        filename: file.originalname,
      });

      const dirPath = `uploads/${projectTitle}/${hash}`;
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const filePath = path.join(dirPath, "file");

      if (!fs.existsSync(filePath)) {
        fs.renameSync(file.path, filePath);
        await fileEntry.save();
        uploadedFiles.push(fileEntry);
      }
    } catch (error) {
      console.error("Error uploading a file:", error);
    }
  }

  return uploadedFiles;
};

// Single file upload
app.post("/projects/:id/upload", upload.single("file"), async (req, res) => {
  const { id } = req.params;
  const project = await Project.findById(id);

  if (!project) return res.status(404).send("Project not found");

  const uploadedFiles = await handleFileUploads([req.file], id, project.title);

  if (uploadedFiles.length > 0) {
    res.send(uploadedFiles[0]);
  } else {
    res.status(409).send("File may already exist");
  }
});

// Multiple files upload
app.post("/projects/:id/uploads", upload.array("files[]"), async (req, res) => {
  const { id } = req.params;
  const project = await Project.findById(id);

  if (!project) return res.status(404).send("Project not found");

  const uploadedFiles = await handleFileUploads(req.files, id, project.title);

  if (uploadedFiles.length > 0) {
    res.send(uploadedFiles);
  } else {
    res
      .status(409)
      .send("No new files were uploaded. Files may already exist.");
  }
});

// Fetch a single file's details
app.get("/projects/:projectId/files/:fileId", async (req, res) => {
  const { projectId, fileId } = req.params;

  try {
    // Find the file by its projectId and fileId
    const file = await FileEntry.findOne({ projectId, id: fileId });

    if (!file) {
      return res.status(404).send("File not found");
    }

    res.send(file);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).send("An error occurred while fetching file");
  }
});

// Edit file title
app.put("/projects/:projectId/files/:fileId", async (req, res) => {
  const { projectId, fileId } = req.params;
  const { newTitle } = req.body; // Assume that the new title comes in the request body

  try {
    // Find the file by its projectId and fileId
    const file = await FileEntry.findOne({ projectId, id: fileId });

    if (!file) {
      return res.status(404).send("File not found");
    }

    // Update the title
    file.title = newTitle;

    // Save changes to the database
    await file.save();

    res.send(file);
  } catch (error) {
    console.error("Error editing file title:", error);
    res.status(500).send("An error occurred while editing file title");
  }
});

// Delete file
app.delete("/projects/:projectId/files/:fileId", async (req, res) => {
  const { projectId, fileId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) return res.status(404).send("Project not found");

    // Delete file entry from the database
    await FileEntry.deleteOne({ projectId, id: fileId });

    // Delete the corresponding file from the filesystem
    const dirPath = `uploads/${project.title}`;
    const filePath = path.join(dirPath, fileId);

    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { recursive: true });
    }

    res.send("File deleted");
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).send("An error occurred while deleting file");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
