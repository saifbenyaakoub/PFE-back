const Joi = require("joi");

const signupClient = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        email: Joi.string().required().email(),
        password: Joi.string().required().min(6),
        city: Joi.string().required(),
    }),
};

const signupProvider = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        email: Joi.string().required().email(),
        password: Joi.string().required().min(6),
        city: Joi.string().required(),
        serviceCategory: Joi.string().required(),
    }),
};

const login = {
    body: Joi.object().keys({
        email: Joi.string().required().email(),
        password: Joi.string().required(),
    }),
};

module.exports = {
    signupClient,
    signupProvider,
    login,
};
