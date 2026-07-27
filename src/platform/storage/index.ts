/**
 * Browser storage capabilities. Nothing here stores archive content: the
 * runtime owns archive bytes, and this module only asks the browser about the
 * permission and the space it is willing to talk about.
 */

export {
  browserStoragePersistence,
  createStoragePersistence,
  type StorageManagerLike,
  type StoragePersistence,
} from './persistence'
