import { config } from '../config/config.js'

const CDP_UPLOADER_BROWSER_URL = config.get('cdpUploader.browserUrl')
  ? `${config.get('cdpUploader.browserUrl')}/upload-and-scan`
  : '/upload-and-scan'

export {
  CDP_UPLOADER_BROWSER_URL
}
