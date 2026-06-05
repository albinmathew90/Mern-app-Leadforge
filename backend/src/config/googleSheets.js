import { google } from 'googleapis';
import path from 'path';

// Authenticate using the credentials.json downloaded from Google Cloud Console
const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve('./credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
export default sheets;