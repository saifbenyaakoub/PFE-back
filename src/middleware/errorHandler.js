const ApiError = require("../utils/apiError");

const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        const statusCode = error.statusCode || error instanceof Error ? 400 : 500;
        const message = error.message || "Something went wrong";
        error = new ApiError(statusCode, message, false, err.stack);
    }

    const response = {
        success: false,
        message: error.message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    };

    res.status(error.statusCode || 500).json(response);
};

module.exports = errorHandler;
