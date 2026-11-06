// Vercel serverless function: delegates every request to the compiled NestJS app.
module.exports = require('../dist/serverless').default;
