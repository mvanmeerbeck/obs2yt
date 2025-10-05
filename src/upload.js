import dotenv from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import readline from 'readline';

dotenv.config();

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '';
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';

// Configuration OAuth2 (vous devrez obtenir ces credentials)
const CLIENT_ID = YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// Créer le client OAuth2
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes nécessaires pour YouTube
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

async function editThumbnail(videoId, thumbnailPath) {
  try {
    console.log(`🖼️ Uploading thumbnail: ${thumbnailPath}`);

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    const thumbnailStream = fs.createReadStream(thumbnailPath);

    const result = await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: thumbnailStream,
      },
    });

    console.log(`✅ Thumbnail uploaded successfully`);

    const originalExt = path.extname(thumbnailPath);
    const originalDir = path.dirname(thumbnailPath); // Dossier sur le Mac
    const newThumbnailPath = path.join(
      originalDir,
      'thumbnails',
      `${videoId}${originalExt}`
    );

    console.log(`📝 Renaming on Mac: ${thumbnailPath} > ${newThumbnailPath}`);

    // Rename directement sur le Mac (pas de cross-device)
    fs.renameSync(thumbnailPath, newThumbnailPath);
    console.log(`✅ Thumbnail renamed successfully: ${newThumbnailPath}`);
  } catch (thumbnailError) {
    console.error('⚠️ Thumbnail upload failed:', thumbnailError.message);
    // Ne pas faire échouer l'upload si juste la thumbnail échoue
  }
}

async function uploadToYouTube(
  videoPath,
  title,
  description,
  deleteAfterUpload = false
) {
  try {
    console.log('🚀 Starting YouTube upload...');

    // Vérifier que le fichier existe
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File not found: ${videoPath}`);
    }

    // Créer le service YouTube
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    // Paramètres de la vidéo
    const videoMetadata = {
      snippet: {
        title: title || 'Test Upload',
        description: description || 'Uploaded via Node.js API',
        tags: ['nodejs', 'youtube-api', 'upload'],
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'private', // 'public', 'unlisted', 'private'
      },
    };

    // Créer le stream de lecture du fichier
    const fileSize = fs.statSync(videoPath).size;
    const fileStream = fs.createReadStream(videoPath);

    console.log(`📁 File: ${path.basename(videoPath)}`);
    console.log(`📊 Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    // Upload avec progression
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: videoMetadata,
      media: {
        body: fileStream,
      },
    });

    console.log('✅ Upload completed!');
    console.log(`🎬 Video ID: ${response.data.id}`);
    console.log(`🔗 URL: https://www.youtube.com/watch?v=${response.data.id}`);

    // Supprimer le fichier si demandé
    if (deleteAfterUpload) {
      try {
        fs.unlinkSync(videoPath);
        console.log(`🗑️ File deleted: ${videoPath}`);
      } catch (deleteError) {
        console.warn(`⚠️ Could not delete file: ${deleteError.message}`);
        // Ne pas faire échouer l'upload si la suppression échoue
      }
    }

    return response.data;
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    throw error;
  }
}

// Fonction pour générer l'URL d'autorisation
function getAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🔑 Authorization URL:');
  console.log(authUrl);
  console.log('\n1. Open this URL in your browser');
  console.log('2. Authorize the application');
  console.log('3. Copy the authorization code');

  return authUrl;
}

// Fonction pour échanger le code contre des tokens
async function getTokenFromCode(authCode) {
  try {
    const { tokens } = await oauth2Client.getToken(authCode);
    oauth2Client.setCredentials(tokens);

    console.log('✅ Tokens obtained!');
    console.log('Save these tokens for future use:');
    console.log(JSON.stringify(tokens, null, 2));

    return tokens;
  } catch (error) {
    console.error('❌ Error getting tokens:', error.message);
    throw error;
  }
}

// Test simple
async function testUpload() {
  try {
    // Chargez les tokens
    if (!loadTokens()) {
      console.log('❌ No tokens found. Run authentication first.');
      return;
    }

    // Chercher un fichier vidéo test
    const possibleVideos = [
      'C:\\Users\\maxim\\Downloads\\2025-10-04_21-06-35.mp4',
    ];

    let testVideoPath = null;
    for (const path of possibleVideos) {
      if (fs.existsSync(path)) {
        testVideoPath = path;
        break;
      }
    }

    if (!testVideoPath) {
      console.log(
        '⚠️ No test video found. Place a test.mp4 file in Videos, Desktop, or Documents folder.'
      );
      console.log('Or specify a custom path:');
      console.log(
        'const { uploadToYouTube, loadTokens } = require("./upload.js");'
      );
      console.log('loadTokens();');
      console.log(
        'uploadToYouTube("path/to/your/video.mp4", "Test Title", "Test Description");'
      );
      return;
    }

    await uploadToYouTube(
      testVideoPath,
      'Test Upload from Replay App',
      'This is a test upload using the YouTube API from my Electron app',
      false // Ne pas supprimer le fichier de test
    );
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Fonction pour l'authentification complète
async function doCompleteAuth() {
  try {
    // 1. Afficher l'URL d'auth
    const authUrl = getAuthUrl();

    // 2. Attendre l'input de l'utilisateur
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question('\nPaste the authorization code here: ', async authCode => {
        try {
          // 3. Échanger le code contre des tokens
          console.log('🔄 Exchanging code for tokens...');
          const tokens = await getTokenFromCode(authCode);

          // 4. Sauvegarder les tokens
          fs.writeFileSync(
            'youtube-tokens.json',
            JSON.stringify(tokens, null, 2)
          );
          console.log('✅ Tokens saved to youtube-tokens.json');

          rl.close();
          resolve(tokens);
        } catch (error) {
          console.error('❌ Auth failed:', error.message);
          rl.close();
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('❌ Complete auth failed:', error.message);
    throw error;
  }
}

// Fonction pour charger les tokens existants
function loadTokens() {
  try {
    if (fs.existsSync('youtube-tokens.json')) {
      const tokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
      oauth2Client.setCredentials(tokens);
      console.log('✅ Loaded existing tokens');
      return true;
    }
  } catch (error) {
    console.error('❌ Error loading tokens:', error.message);
  }
  return false;
}

// Export des fonctions
export {
  doCompleteAuth,
  editThumbnail,
  getAuthUrl,
  getTokenFromCode,
  loadTokens,
  testUpload,
  uploadToYouTube,
};

// Si le fichier est exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎬 YouTube Upload Setup');
  console.log('======================');

  async function main() {
    // Vérifier si on a déjà des tokens
    if (loadTokens()) {
      console.log('✅ Authentication already complete!');
      console.log('You can now use uploadToYouTube() function');

      // Proposer de tester l'upload
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(
        '\nDo you want to test upload with a video file? (y/n): ',
        async answer => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            await testUpload();
          } else {
            console.log(
              'Ready to upload! Use the uploadToYouTube() function in your code.'
            );
          }
          rl.close();
        }
      );
    } else {
      console.log('🔑 Starting authentication process...');
      await doCompleteAuth();
      console.log('🎉 Authentication complete! You can now upload videos.');
    }
  }

  main().catch(console.error);
}
