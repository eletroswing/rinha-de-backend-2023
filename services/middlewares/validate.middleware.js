const validateJsonMiddleware = (validationSchema) => {
  return (req, res, next) => {
    try {
      const requestData = req.body

      for (const key in validationSchema) {
        const rules = validationSchema[key];
        const value = requestData[key];

        if (rules.required && !value) {
          throw new Error(`'${key}' is required.`);
        }
        
        if (value) {
          if (rules.type && typeof value !== rules.type) {
            throw new Error(`'${key}' must be of type ${rules.type}.`);
          }

          if (rules.format && rules.type !== "object" && !rules.format.test(value)) {
            throw new Error(`'${key}' format is invalid, must be: ${rules.format}`);
          }

          if (Array.isArray(value)) {
            for (const element of value) {
              if (typeof element !== (rules.itemType || 'string')) {
                throw new Error(`Each element in '${key}' array must be a ${rules.itemType || 'string'}.`);
              }

              if (!rules.format.test(element)) {
                throw new Error(`Element in '${key}' array has invalid format. Must match: ${rules.format}`);
              }
            }
          }
        }
      }

      next();
    } catch (error) {
      res.writeHead(422, { "Content-Type": "application/json" });
      const response = { error: error.message };
      res.end(JSON.stringify(response));
    }
  };
};

module.exports = validateJsonMiddleware;