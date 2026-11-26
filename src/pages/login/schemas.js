import Joi from 'joi'

/**
 * What Entra posts to `/login/callback`: a code and state, or an error.
 * Every field must be a single string, and `error_description` is
 * renamed to `errorDescription`. Anything else Entra sends (e.g.
 * `session_state`) is stripped.
 */
const callbackPayloadSchema = Joi.object({
  code: Joi.string(),
  state: Joi.string(),
  error: Joi.string(),
  errorDescription: Joi.string()
})
  .rename('error_description', 'errorDescription')
  .options({ stripUnknown: true })

export {
  callbackPayloadSchema
}
