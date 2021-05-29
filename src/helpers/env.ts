export const getPort = (defaultPort = 3000) => process.env.PORT ? parseInt(process.env.PORT) : defaultPort

export const checkEnvVars = (...keys: string[]) =>
  keys.every(key => process.env.hasOwnProperty(key) && !!process.env[key])
