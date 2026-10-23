module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      googleMaps: { apiKey: process.env.EXPO_PUBLIC_API_KEY },
    },
  },
});
