import { app, Menu, Tray, globalShortcut } from 'electron/main'
import { nativeImage } from 'electron/common'
import WebSocket from 'ws'
import icon from './assets/icon.png'
import { uploadToYouTube, loadTokens, editThumbnail } from './upload.js'
import { extractFirstFrame } from './ffmpeg.js'
import ffmpegPath from 'ffmpeg-static'
import dotenv from 'dotenv'

dotenv.config()

const OBS_WEBSOCKET_URL = process.env.OBS_WEBSOCKET_URL || 'ws://localhost:4455'
const NETWORK_PATH = process.env.NETWORK_PATH || '\\macbook-pro.local\Macintosh HD'
const UPLOAD = process.env.UPLOAD || 'true'

console.info('🔧 FFmpeg path:', ffmpegPath)

let tray = null
let ws = null
let obsState = false
let recordingState = ''
let uploadingState = ''
let hasYouTubeAuth = false

const iconImage = nativeImage.createFromDataURL(icon)

// 🎯 Fonction d'auto-upload vers YouTube
async function autoUploadToYouTube(videoPath) {
  try {
    const thumbnailPath = await extractFirstFrame(videoPath)
    console.log(`🖼️ Thumbnail extracted: ${thumbnailPath}`)

    uploadingState = 'Starting YouTube upload...'
    tray.setContextMenu(contextMenu())
    
    console.log(`🚀 Starting auto-upload: ${videoPath}`)
    
    const title = `Recording ${new Date().toLocaleString()}`
    const description = 'Auto-uploaded from Replay App'
    
    uploadingState = 'Uploading to YouTube...'
    tray.setContextMenu(contextMenu())

    const result = await uploadToYouTube(videoPath, title, description, true) // 🗑️ true = supprimer après upload
    
    uploadingState = `✅ Uploaded: ${result.id}`
    console.log(`🎬 Video uploaded: https://www.youtube.com/watch?v=${result.id}`)
    
    await editThumbnail(result.id, thumbnailPath)
  } catch (error) {
    uploadingState = `❌ Upload failed: ${error.message}`
    console.error('Upload failed:', error)
  }
  
  tray.setContextMenu(contextMenu())
}

const contextMenu = () => Menu.buildFromTemplate([
  {
    label: obsState ? 'obs connected' : 'obs not connected',
  },
  {
    label: recordingState,
  },
  {
    label: uploadingState,
  },
  {
    label: 'Start recording',
    click: () => {
      ws.send(JSON.stringify({
        "op": 6,
        "d": {
          "requestType": "StartRecord",
          "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
          "requestData": {}
        }
      }));
    },
    accelerator: 'F9'
  },
  {
    label: 'Stop recording',
    click: () => {
      ws.send(JSON.stringify({
        "op": 6,
        "d": {
          "requestType": "StopRecord",
          "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
          "requestData": {}
        }
      }));
    },
    accelerator: 'F10'
  },
  { role: 'quit' }
])

app.whenReady().then(() => { 
  tray = new Tray(iconImage)
  tray.setToolTip('Tray Icon Demo')
  tray.setContextMenu(contextMenu())

  // 🎯 Charger l'authentification YouTube
  hasYouTubeAuth = loadTokens()
  if (hasYouTubeAuth) {
    console.log('✅ YouTube authentication loaded')
    uploadingState = 'YouTube ready'
  } else {
    console.log('⚠️ No YouTube authentication - run: node src/upload.js')
    uploadingState = 'YouTube not authenticated'
  }
  tray.setContextMenu(contextMenu())

  ws = new WebSocket(OBS_WEBSOCKET_URL)

  ws.on('open', function open() {
    console.log('✅ WebSocket connected')

    ws.send(JSON.stringify({
      "op": 1,
      "d": {
        "rpcVersion": 1
      }
    }));
  });
  
  ws.on('error', function error(err) {
    console.log('❌ WebSocket error:', err.message)
  });
  
  ws.on('close', function close() {
    console.log('🔌 WebSocket connection closed')
    obsState = false
    tray.setContextMenu(contextMenu())
  });

  ws.on('message', async function message(data) {
    console.log(data.toString())

    const parsed = JSON.parse(data)

    if (parsed.op === 2)  {
        obsState = true
        tray.setContextMenu(contextMenu())
    }

    if (parsed.op === 7)  {
        tray.setContextMenu(contextMenu())
    }

    if (parsed.op === 5)  {
        if (parsed.d.eventType === 'RecordStateChanged') {
          recordingState = parsed.d.eventData.outputState
          
          // 🎯 Auto-upload quand l'enregistrement s'arrête
          if (parsed.d.eventData.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
            const outputPath = parsed.d.eventData.outputPath
            const networkPath = `${NETWORK_PATH}${outputPath}`
            
            if (hasYouTubeAuth && outputPath) {
              console.log(`📹 Recording stopped: ${outputPath}`)

              autoUploadToYouTube(networkPath)
            } else if (!hasYouTubeAuth) {
              uploadingState = 'No YouTube auth - run: node src/upload.js'
            }
          }
        }

        tray.setContextMenu(contextMenu())
    }     
  });

  globalShortcut.register('F9', () => {
    ws.send(JSON.stringify({
      "op": 6,
      "d": {
        "requestType": "StartRecord",
        "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
        "requestData": {}
      }
    }))    
  })

  globalShortcut.register('F10', () => {
    ws.send(JSON.stringify({
      "op": 6,
      "d": {
        "requestType": "StopRecord",
        "requestId": "f819dcf0-89cc-11eb-8f0e-382c4ac93b9c",
        "requestData": {}
      }
    }))    
  }) 
})

app.on('window-all-closed', function () {
  
})

app.on('activate', function () {

})