import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Extrait la première frame d'une vidéo avec ffmpeg
 * @param {string} videoPath - Chemin vers le fichier vidéo
 * @param {string} outputPath - Chemin de sortie pour l'image (optionnel)
 * @returns {Promise<string>} - Chemin vers l'image extraite
 */
async function extractFirstFrame(videoPath, outputPath = null) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🎥 Extracting first frame from: ${videoPath}`)
      
      // Vérifier que le fichier vidéo existe
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`)
      }
      
      // Créer le chemin de sortie si non spécifié (PNG pour frame raw)
      if (!outputPath) {
        const baseName = path.basename(videoPath, path.extname(videoPath))
        const dir = path.dirname(videoPath)
        outputPath = path.join(dir, `${baseName}_first_frame.png`)
      }
      
      console.log(`📁 Output path: ${outputPath}`)
      
      // Commande ffmpeg pour extraire la frame RAW (aucune transformation)
      const args = [
        '-i', videoPath,           // Fichier d'entrée
        '-vframes', '1',           // Extraire 1 seule frame
        '-y',                      // Écraser le fichier de sortie
        outputPath
      ]
      
      console.log(`🔧 FFmpeg command: ${ffmpegPath} ${args.join(' ')}`)
      
      const ffmpeg = spawn(ffmpegPath, args)
      
      let stderr = ''
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Vérifier que le fichier a été créé
          if (fs.existsSync(outputPath)) {
            console.log(`✅ First frame extracted to: ${outputPath}`)
            resolve(outputPath)
          } else {
            reject(new Error('Output file was not created'))
          }
        } else {
          console.error('❌ FFmpeg stderr:', stderr)
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
        }
      })
      
      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg spawn error:', error)
        reject(error)
      })
      
    } catch (error) {
      console.error('❌ Failed to extract first frame:', error.message)
      reject(error)
    }
  })
}

export { extractFirstFrame }