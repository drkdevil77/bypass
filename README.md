# Wraith's Audio Studio

A browser-based audio editor designed for Railway. Audio is decoded, previewed, and processed in the visitor's browser; the server only serves the website.

## Features
- Load one audio file into Track A or Track B (MP3/WAV and browser-supported audio formats)
- Select one track at a time, so the export never automatically combines the two uploads
- Live preview with adjustable gain, convolution reverb, echo, low-pass filter, playback speed, and pitch shift
- Export the selected processed track as a WAV file
- Responsive dark UI and drag-and-drop uploads

## Deploy to Railway
1. Extract this ZIP.
2. Commit the actual contents of the `wraiths_audio_studio` folder to your GitHub repository (or set Railway Root Directory to that folder if you commit the folder itself). Do not commit only the ZIP.
3. Railway detects the included `Dockerfile`, or can run `npm start` using `package.json`.
4. Generate a public domain in Railway Settings → Networking. The `*.railway.internal` hostname is private to Railway's network.

## Notes
- Pitch shift is implemented through playback-rate changes, so changing pitch also changes duration. Independent pitch shifting requires a more advanced time-stretching algorithm.
- Supported formats depend on the browser's audio decoder. WAV is the most reliable export format.
- This is a client-side editor. Large files require memory while decoded and rendered, so shorter tracks work better on low-memory devices.
