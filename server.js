require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Use routes
app.use("/services", serviceRoutes);
app.use("/tasks", require("./router/tasksRouter"));


app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
