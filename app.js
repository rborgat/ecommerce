const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const path = require("path");
const cors = require("cors");

const compression = require("compression");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const AppError = require("./utils/appError");

const globalError = require("./controllers/errorController");
const userRouter = require("./routes/userRoutes");
const viewRouter = require("./routes/viewRoute");
const cartRouter = require("./routes/cartRoutes");
const bookingRouter = require("./routes/bookingRoutes");
const bookingController = require("./controllers/bookingController");

const app = express();
app.enable("trust proxy");
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(cors());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", "https:", "data:", "ws:"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      scriptSrc: ["'self'", "https:", "blob:"],
      styleSrc: ["'self'", "https:", "unsafe-inline"],
    },
  })
);
app.post(
  "/webhook-checkout",
  express.raw({ type: "application/json" }),
  bookingController.webhookCheckout
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(compression());

app.use(flash());

const sessionStore = new MongoStore({
  mongoUrl: process.env.DATABASE.replace(
    "<PASSWORD>",
    process.env.DATABASE_PASSWORD
  ),
  collectionName: "sessions",
  autoRemove: "native",
  autoRemoveInterval: 10,
});
app.use(
  session({
    secret: process.env.SECRET_KEY,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: "none",
      httpOnly: true,
    },
  })
);

require("./utils/passport");

app.use(passport.initialize());
app.use(passport.session());

app.use(async function (req, res, next) {
  res.locals.session = req.session;
  res.locals.user = req.user;

  next();
});

app.use("/", viewRouter);
app.use("/cart/", cartRouter);
app.use("/api/v1/booking", bookingRouter);
app.use("/api/v1/users", userRouter);

// Handling request to incorrect routes
app.all("*", (req, res, next) => {
  next(new AppError(`${req.originalUrl} does not exist on this app.`, 404));
});

app.use(globalError);
module.exports = app;
