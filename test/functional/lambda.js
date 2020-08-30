export const func = async (keyValueStore, user) => {
  return String(await keyValueStore.inc(user, 100))
}
