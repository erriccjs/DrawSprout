/**
 * Every chrome string, in both languages. Indonesian matches the copy the app
 * already showed. English is short and meant to be read aloud to a child.
 */

import type { Locale } from './locale';

export interface Messages {
  readonly documentTitle: string;
  readonly documentDescription: string;
  readonly language: string;
  readonly english: string;
  readonly indonesian: string;
  readonly pickerTitle: string;
  readonly pickerLead: string;
  readonly tracePhoto: string;
  readonly tracePlace: string;
  readonly traceChoose: string;
  readonly traceStart: string;
  readonly traceOpacity: string;
  readonly traceShow: string;
  readonly traceHide: string;
  readonly traceLock: string;
  readonly traceUnlock: string;
  readonly traceScale: string;
  readonly traceInclude: string;
  readonly doodlePhoto: string;
  readonly doodleLead: string;
  readonly doodleWorking: string;
  readonly doodleFollow: string;
  readonly doodleTrace: string;
  readonly doodleBack: string;
  readonly doodleFailed: string;
  readonly doodleTraceOpacity: string;
  readonly doodleTraceShow: string;
  readonly doodleTraceHide: string;
  readonly doodleTraceLock: string;
  readonly doodleTraceUnlock: string;
  readonly doodleTraceScale: string;
  readonly doodleTraceInclude: string;
  readonly offlineReady: string;
  readonly updateLoading: string;
  readonly updateReady: string;
  readonly later: string;
  readonly loadUpdate: string;
  readonly fromPhoto: string;
  readonly noPhotoLessons: string;
  readonly deletePhotoLesson: string;
  readonly deletePhotoFailed: string;
  readonly cancel: string;
  readonly delete: string;
  readonly deleteLesson: string;
  readonly pictureOf: string;
  readonly createFromPhoto: string;
  readonly galleryTitle: string;
  readonly galleryLoadError: string;
  readonly galleryEmpty: string;
  readonly oldLesson: string;
  readonly open: string;
  readonly savePng: string;
  readonly deleteArtworkQuestion: string;
  readonly artworkUnsaved: string;
  readonly artworkDeleteFailed: string;
  readonly saveFailed: string;
  readonly downloadSentShort: string;
  readonly openNamed: string;
  readonly savePngNamed: string;
  readonly deleteNamed: string;
  readonly artworkNamed: string;
  readonly preparing: string;
  readonly lessonUnavailable: string;
  readonly bootstrapFailure: string;
  readonly loadFailure: string;
  readonly exitUnsaved: string;
  readonly back: string;
  readonly photoFlowTitle: string;
  readonly photoFlowLead: string;
  readonly takePhoto: string;
  readonly pickFromGallery: string;
  readonly camera: string;
  readonly gallery: string;
  readonly cropLead: string;
  readonly useThisPart: string;
  readonly changePhoto: string;
  readonly beforeSendTitle: string;
  readonly beforeSendBody: string;
  readonly photoToSend: string;
  readonly makingLines: string;
  readonly tryAgain: string;
  readonly iAgree: string;
  readonly cancelRequest: string;
  readonly checkFirst: string;
  readonly photoChosen: string;
  readonly lineArt: string;
  readonly photoCaption: string;
  readonly illustrationCaption: string;
  readonly useIt: string;
  readonly moreLikePhoto: string;
  readonly simpler: string;
  readonly photoToCrop: string;
  readonly resizePart: string;
  readonly finishTitle: string;
  readonly finishLead: string;
  readonly savePicture: string;
  readonly freeDraw: string;
  readonly chooseAnother: string;
  readonly drawAgain: string;
  readonly choiceDrawAgain: string;
  readonly downloadSent: string;
  readonly saveImageFailed: string;
  readonly yourArtwork: string;
  readonly clearQuestion: string;
  readonly keepDrawing: string;
  readonly startNew: string;
  readonly clearAll: string;
  readonly clearAllChoice: string;
  readonly restartChoice: string;
  readonly restartArtwork: string;
  readonly startOver: string;
  readonly stepOf: string;
  readonly phaseOutline: string;
  readonly phaseDetail: string;
  readonly phaseColor: string;
  readonly showStep: string;
  readonly hideStep: string;
  readonly done: string;
  readonly next: string;
  readonly help: string;
  readonly guidesVisible: string;
  readonly guidesVisibleHelp: string;
  readonly guidesTemporary: string;
  readonly guidesTemporaryHelp: string;
  readonly guidesIndependent: string;
  readonly guidesIndependentHelp: string;
  readonly showHintAgain: string;
  readonly showHint: string;
  readonly hintLength: string;
  readonly seconds: string;
  readonly thisStep: string;
  readonly wholeLesson: string;
  readonly restartQuestion: string;
  readonly repeatStep: string;
  readonly continueLesson: string;
  readonly seePicture: string;
  readonly startFreshAttempt: string;
  readonly resumeLeadProgress: string;
  readonly resumeLeadDone: string;
  readonly moreFor: string;
  readonly traceStaysHere: string;
  readonly doodleUsesServer: string;
  readonly traceOpening: string;
  readonly traceNone: string;
  readonly traceLoading: string;
  readonly traceBadType: string;
  readonly drawMode: string;
  readonly pencilMode: string;
  readonly pencil: string;
  readonly fingerMode: string;
  readonly finger: string;
  readonly tools: string;
  readonly pen: string;
  readonly brush: string;
  readonly eraser: string;
  readonly history: string;
  readonly undo: string;
  readonly redo: string;
  readonly speakStep: string;
  readonly speakUnavailable: string;
  readonly replayLine: string;
  readonly helpLead: string;
  readonly helpHear: string;
  readonly helpWatch: string;
  readonly helpRepeat: string;
  readonly grownUp: string;
  readonly grownUpPencil: string;
  readonly moreTools: string;
  readonly sponge: string;
  readonly cheer: string;
  readonly muteCheer: string;
  readonly unmuteCheer: string;
  readonly drawModeNote: string;
  readonly colorHelp: string;
  readonly boundaryOn: string;
  readonly boundaryOff: string;
  readonly boundaryNote: string;
  readonly pickColor: string;
  readonly followGuide: string;
  readonly palette: string;
  readonly colorSwatch: string;
  readonly recentColors: string;
  readonly recentColor: string;
  readonly currentColor: string;
  readonly myColor: string;
  readonly guideColor: string;
  readonly mixed: string;
  readonly brushSize: string;
  readonly stepSize: string;
  readonly mySize: string;
  readonly choosePicture: string;
  readonly fitScreen: string;
  readonly exitFullscreen: string;
  readonly enterFullscreen: string;
  readonly canvasLabel: string;
  readonly freeDrawInstruction: string;
  readonly freeDrawHint: string;
  readonly notDurableShort: string;
  readonly ready: string;
  readonly saving: string;
  readonly saved: string;
  readonly storageFullShort: string;
  readonly saveFailedShort: string;
  readonly notDurable: string;
  readonly storageFull: string;
  readonly saveMaybeFailed: string;
  readonly restartFailed: string;
  readonly enlargeExample: string;
  readonly bigExample: string;
  readonly closeExample: string;
  readonly targetPreview: string;
  readonly tabletNotice: string;
  readonly tabletOk: string;
  readonly photoUnreadable: string;
  readonly lessonNotSaved: string;
  readonly photoUnusable: string;
}

const id: Messages = {
  documentTitle: 'DrawSprout — Belajar Menggambar',
  documentDescription: 'Belajar menggambar langkah demi langkah di tablet.',
  language: 'Bahasa',
  english: 'English',
  indonesian: 'Indonesia',
  pickerTitle: 'Mau gambar apa hari ini?',
  pickerLead: 'Pilih satu gambar.',
  tracePhoto: 'Jiplak foto',
  tracePlace: 'Geser fotonya, atur besarnya, lalu mulai.',
  traceChoose: 'Pilih atau ambil foto',
  traceStart: 'Mulai jiplak',
  traceOpacity: 'Ketebalan foto',
  traceShow: 'Tampilkan foto',
  traceHide: 'Sembunyikan foto',
  traceLock: 'Kunci foto',
  traceUnlock: 'Geser foto',
  traceScale: 'Ukuran foto',
  traceInclude: 'Simpan bersama foto',
  doodlePhoto: 'Doodle dari foto',
  doodleLead: 'Foto jadi langkah gambar. Kalau tidak bisa, pilih gambar lain.',
  doodleWorking: 'Membuat doodle…',
  doodleFollow: 'Ikuti langkahnya',
  doodleTrace: 'Jiplak doodlenya',
  doodleBack: 'Pilih gambar lain',
  doodleFailed: 'Doodle tidak jadi. Pilih gambar dari daftar.',
  doodleTraceOpacity: 'Ketebalan doodle',
  doodleTraceShow: 'Tampilkan doodle',
  doodleTraceHide: 'Sembunyikan doodle',
  doodleTraceLock: 'Kunci doodle',
  doodleTraceUnlock: 'Geser doodle',
  doodleTraceScale: 'Ukuran doodle',
  doodleTraceInclude: 'Simpan bersama doodle',
  offlineReady: 'Bisa dibuka tanpa internet.',
  updateLoading: 'Memuat versi baru…',
  updateReady: 'Ada versi baru. Gambar yang sudah tersimpan tetap ada.',
  later: 'Nanti saja',
  loadUpdate: 'Muat versi baru',
  fromPhoto: 'Dari foto',
  noPhotoLessons: 'Belum ada pelajaran dari foto.',
  deletePhotoLesson: 'Hapus pelajaran foto ini?',
  deletePhotoFailed: 'Pelajaran foto belum terhapus. Coba lagi.',
  cancel: 'Batal',
  delete: 'Hapus',
  deleteLesson: 'Hapus pelajaran {title}',
  pictureOf: 'Gambar {title}',
  createFromPhoto: 'Buat dari foto',
  galleryTitle: 'Karyaku',
  galleryLoadError: 'Daftar karya belum bisa dibuka.',
  galleryEmpty: 'Belum ada karya tersimpan.',
  oldLesson: 'Pelajaran lama',
  open: 'Buka',
  savePng: 'Simpan PNG',
  deleteArtworkQuestion: 'Hapus karya ini?',
  artworkUnsaved: 'Karya ini tidak dapat disimpan.',
  artworkDeleteFailed: 'Karya ini belum terhapus. Coba lagi.',
  saveFailed: 'Gagal menyimpan gambar.',
  downloadSentShort: 'File {name} dikirim ke unduhan browser.',
  openNamed: 'Buka {title}',
  savePngNamed: 'Simpan PNG {title}',
  deleteNamed: 'Hapus {title}',
  artworkNamed: 'Karya {title}',
  preparing: 'Menyiapkan pelajaran…',
  lessonUnavailable: 'Pelajaran tidak dapat dibuka',
  bootstrapFailure: 'Maaf, pelajaran belum bisa dibuka sekarang. Coba lagi nanti ya.',
  loadFailure: 'Karya sebelumnya tidak dapat dibuka. Kamu bisa mulai menggambar lagi.',
  exitUnsaved: 'Gambar tadi mungkin belum tersimpan. Tidak apa-apa, kamu bisa menggambar lagi.',
  back: 'Kembali',
  photoFlowTitle: 'Buat dari foto',
  photoFlowLead: 'Pilih foto benda utamanya. Ini untuk orang tua, bukan untuk anak.',
  takePhoto: 'Ambil foto',
  pickFromGallery: 'Pilih dari galeri',
  camera: 'Kamera',
  gallery: 'Galeri',
  cropLead: 'Pilih bagian utamanya, lalu lanjut.',
  useThisPart: 'Pakai bagian ini',
  changePhoto: 'Ganti foto',
  beforeSendTitle: 'Sebelum foto dikirim',
  beforeSendBody: 'Foto ini dikirim ke server DrawSprout dan ke OpenAI supaya bisa dibuat menjadi gambar garis. Foto tidak disimpan setelah diproses. Pelajaran yang dihasilkan tersimpan di perangkat ini, dan menghapusnya menghapus gambar turunan itu juga.',
  photoToSend: 'Foto yang akan dikirim',
  makingLines: 'Membuat garis…',
  tryAgain: 'Coba lagi',
  iAgree: 'Saya setuju, lanjut',
  cancelRequest: 'Batalkan',
  checkFirst: 'Cek dulu',
  photoChosen: 'Foto yang dipilih',
  lineArt: 'Ilustrasi garis',
  photoCaption: 'Foto',
  illustrationCaption: 'Ilustrasi',
  useIt: 'Gunakan',
  moreLikePhoto: 'Lebih mirip foto',
  simpler: 'Lebih sederhana',
  photoToCrop: 'Foto untuk dipotong',
  resizePart: 'Ubah ukuran bagian',
  finishTitle: 'Selesai! Ini karyamu.',
  finishLead: 'Ini gambarmu. Garis panduan tidak ikut tersimpan.',
  savePicture: 'Simpan gambar (PNG)',
  freeDraw: 'Gambar bebas',
  chooseAnother: 'Pilih gambar lain',
  drawAgain: '← Gambar lagi',
  choiceDrawAgain: 'Pilihan gambar lagi',
  downloadSent: 'File {name} dikirim ke unduhan browser. Tempat penyimpanannya diatur oleh browser dan sistem, bukan oleh aplikasi ini.',
  saveImageFailed: 'Gagal menyimpan gambar: {detail}',
  yourArtwork: 'Karyamu: {title}',
  clearQuestion: 'Mau mulai dengan gambar kosong?',
  keepDrawing: 'Gambar lama tetap ada',
  startNew: 'Ya, mulai gambar baru',
  clearAll: 'Hapus semua',
  clearAllChoice: 'Pilihan hapus semua',
  restartChoice: 'Mulai ulang karya',
  restartArtwork: 'Mulai ulang karya',
  startOver: 'Mulai ulang',
  stepOf: 'Tahap {current} dari {total}',
  phaseOutline: 'bentuk besar',
  phaseDetail: 'detail',
  phaseColor: 'mewarnai',
  showStep: 'Tampilkan langkah',
  hideStep: 'Sembunyikan langkah',
  done: 'Selesai ✓',
  next: 'Lanjut →',
  help: 'Bantuan',
  guidesVisible: 'Garis tetap',
  guidesVisibleHelp: 'Garisnya tetap di kertas.',
  guidesTemporary: 'Petunjuk sementara',
  guidesTemporaryHelp: 'Garisnya hilang sendiri.',
  guidesIndependent: 'Mandiri',
  guidesIndependentHelp: 'Tanpa garis. Minta kalau perlu.',
  showHintAgain: 'Tampilkan petunjuk lagi',
  showHint: 'Tampilkan petunjuk',
  hintLength: 'Lama petunjuk',
  seconds: '{count} detik',
  thisStep: 'Langkah ini',
  wholeLesson: 'Seluruh pelajaran',
  restartQuestion: 'Mulai ulang gambar ini? Goresannya hilang. Karya lain tetap tersimpan.',
  repeatStep: 'Ulangi langkah ini',
  continueLesson: 'Lanjutkan',
  seePicture: 'Lihat karyamu',
  startFreshAttempt: 'Gambar baru',
  resumeLeadProgress: 'Kamu sudah mulai gambar ini.',
  resumeLeadDone: 'Gambar ini sudah selesai.',
  moreFor: 'Lainnya untuk {title}',
  traceStaysHere: 'Jiplak foto tetap di perangkat ini.',
  doodleUsesServer: 'Doodle dari foto dibuat di server.',
  traceOpening: 'Pilih foto untuk dijiplak. Fotonya tetap di perangkat ini.',
  traceNone: 'Tidak ada foto yang dipilih.',
  traceLoading: 'Membuka foto…',
  traceBadType: 'Pilih foto JPG atau PNG ya.',
  drawMode: 'Cara menggambar',
  pencilMode: 'Mode pensil',
  pencil: 'Pensil',
  fingerMode: 'Mode jari',
  finger: 'Jari',
  tools: 'Alat',
  pen: 'Pen',
  brush: 'Kuas',
  eraser: 'Penghapus',
  history: 'Riwayat',
  undo: 'Batalkan',
  redo: 'Ulangi',
  speakStep: 'Dengarkan',
  speakUnavailable: 'Suara belum ada',
  replayLine: 'Lihat garisnya',
  helpLead: 'Ikuti garis merah.',
  helpHear: 'Dengar langkahnya.',
  helpWatch: 'Garisnya bergerak.',
  helpRepeat: 'Ulangi kalau mau.',
  grownUp: 'Untuk orang tua',
  grownUpPencil: 'Mode pensil hanya untuk stylus. Jari tidak menggambar.',
  moreTools: 'Lainnya',
  sponge: 'Spons',
  cheer: 'Bintang',
  muteCheer: 'Diamkan bintang',
  unmuteCheer: 'Nyalakan suara',
  drawModeNote: 'Ganti mode di tombol Jari atau Pensil. Mode pensil hanya menerima stylus. Sentuhan yang sangat lebar diabaikan di mode jari, tetapi penolakan telapak tangan dari sistem tidak dijamin.',
  colorHelp: 'Bantuan warna',
  boundaryOn: 'Batas area: aktif',
  boundaryOff: 'Batas area: nonaktif',
  boundaryNote: 'Warna tetap di dalam bentuk contoh. Matikan jika garismu berbeda.',
  pickColor: 'Pilih warna, {name}',
  followGuide: 'Ikuti panduan',
  palette: 'Palet',
  colorSwatch: 'Warna {name}',
  recentColors: 'Warna terakhir',
  recentColor: 'Warna terakhir {name}',
  currentColor: 'Warna sekarang:',
  myColor: ' warna pilihanku',
  guideColor: ' warna panduan',
  mixed: 'campuran',
  brushSize: 'Ukuran kuas',
  stepSize: 'Ukuran langkah',
  mySize: 'Ukuran pilihanku',
  choosePicture: 'Pilih gambar',
  fitScreen: 'Sesuai layar',
  exitFullscreen: 'Keluar layar penuh',
  enterFullscreen: 'Layar penuh',
  canvasLabel: 'Kanvas gambar. {instruction}',
  freeDrawInstruction: 'Gambar bebas.',
  freeDrawHint: 'Gambar apa saja.',
  notDurableShort: 'Tidak tersimpan permanen',
  ready: 'Siap',
  saving: 'Menyimpan…',
  saved: 'Tersimpan',
  storageFullShort: 'Penyimpanan penuh',
  saveFailedShort: 'Gagal menyimpan',
  notDurable: 'Penyimpanan permanen tidak tersedia di browser ini, jadi karya ini hanya bertahan selama tab terbuka.',
  storageFull: 'Penyimpanan penuh. Karya yang sudah tersimpan tetap aman, tetapi goresan terbaru belum tersimpan. Kosongkan ruang, lalu coba lagi.',
  saveMaybeFailed: 'Karya terbaru mungkin belum tersimpan.',
  restartFailed: 'Belum bisa mulai gambar baru. Coba lagi.',
  enlargeExample: 'Perbesar contoh',
  bigExample: 'Contoh besar',
  closeExample: 'Tutup contoh',
  targetPreview: 'Contoh hasil akhir: {title}',
  tabletNotice: 'DrawSprout paling nyaman di tablet. Di HP tetap bisa menggambar.',
  tabletOk: 'Mengerti',
  photoUnreadable: 'Foto tidak dapat dibaca. Pilih gambar lain.',
  lessonNotSaved: 'Pelajaran belum tersimpan di perangkat ini.',
  photoUnusable: 'Foto ini belum bisa dipakai. Coba lagi ya.',
};

const en: Messages = {
  documentTitle: 'DrawSprout — Learn to Draw',
  documentDescription: 'Learn to draw, one step at a time, on a tablet.',
  language: 'Language',
  english: 'English',
  indonesian: 'Indonesia',
  pickerTitle: 'What shall we draw today?',
  pickerLead: 'Pick one picture.',
  tracePhoto: 'Trace a photo',
  tracePlace: 'Move the photo, change its size, then start.',
  traceChoose: 'Choose or take a photo',
  traceStart: 'Start tracing',
  traceOpacity: 'How strong the photo is',
  traceShow: 'Show the photo',
  traceHide: 'Hide the photo',
  traceLock: 'Lock the photo',
  traceUnlock: 'Move the photo',
  traceScale: 'Photo size',
  traceInclude: 'Save with the photo',
  doodlePhoto: 'Doodle from a photo',
  doodleLead: 'The photo becomes drawing steps. If it cannot, pick another picture.',
  doodleWorking: 'Making the doodle…',
  doodleFollow: 'Follow the steps',
  doodleTrace: 'Trace the doodle',
  doodleBack: 'Pick another picture',
  doodleFailed: 'The doodle did not work. Pick a picture from the list.',
  doodleTraceOpacity: 'How strong the doodle is',
  doodleTraceShow: 'Show the doodle',
  doodleTraceHide: 'Hide the doodle',
  doodleTraceLock: 'Lock the doodle',
  doodleTraceUnlock: 'Move the doodle',
  doodleTraceScale: 'Doodle size',
  doodleTraceInclude: 'Save with the doodle',
  offlineReady: 'Works without the internet.',
  updateLoading: 'Loading the new version…',
  updateReady: 'A new version is ready. Your saved pictures stay here.',
  later: 'Not now',
  loadUpdate: 'Load the new version',
  fromPhoto: 'From a photo',
  noPhotoLessons: 'No photo lessons yet.',
  deletePhotoLesson: 'Delete this photo lesson?',
  deletePhotoFailed: 'That photo lesson is still here. Try again.',
  cancel: 'Cancel',
  delete: 'Delete',
  deleteLesson: 'Delete the {title} lesson',
  pictureOf: 'Picture of {title}',
  createFromPhoto: 'Make from a photo',
  galleryTitle: 'My pictures',
  galleryLoadError: 'Your pictures could not be opened.',
  galleryEmpty: 'No saved pictures yet.',
  oldLesson: 'Older lesson',
  open: 'Open',
  savePng: 'Save PNG',
  deleteArtworkQuestion: 'Delete this picture?',
  artworkUnsaved: 'This picture could not be saved.',
  artworkDeleteFailed: 'This picture is still here. Try again.',
  saveFailed: 'The picture could not be saved.',
  downloadSentShort: 'File {name} was sent to the browser downloads.',
  openNamed: 'Open {title}',
  savePngNamed: 'Save PNG {title}',
  deleteNamed: 'Delete {title}',
  artworkNamed: 'Picture of {title}',
  preparing: 'Getting the lesson ready…',
  lessonUnavailable: 'The lesson cannot be opened',
  bootstrapFailure: 'Sorry, the lessons cannot be opened right now. Please try again later.',
  loadFailure: 'The last picture could not be opened. You can start drawing again.',
  exitUnsaved: 'That picture might not have been saved. That is okay. You can draw again.',
  back: 'Back',
  photoFlowTitle: 'Make from a photo',
  photoFlowLead: 'Choose a photo of the main thing. This part is for a grown-up, not for a child.',
  takePhoto: 'Take a photo',
  pickFromGallery: 'Choose from the gallery',
  camera: 'Camera',
  gallery: 'Gallery',
  cropLead: 'Choose the main part, then continue.',
  useThisPart: 'Use this part',
  changePhoto: 'Change photo',
  beforeSendTitle: 'Before the photo is sent',
  beforeSendBody: 'This photo is sent to the DrawSprout server and to OpenAI so it can become a line drawing. The photo is not kept after that. The lesson is saved on this device, and deleting it deletes that drawing too.',
  photoToSend: 'Photo that will be sent',
  makingLines: 'Making the lines…',
  tryAgain: 'Try again',
  iAgree: 'I agree, continue',
  cancelRequest: 'Cancel',
  checkFirst: 'Check first',
  photoChosen: 'Chosen photo',
  lineArt: 'Line drawing',
  photoCaption: 'Photo',
  illustrationCaption: 'Drawing',
  useIt: 'Use this',
  moreLikePhoto: 'More like the photo',
  simpler: 'Simpler',
  photoToCrop: 'Photo to crop',
  resizePart: 'Resize the part',
  finishTitle: 'Done! This is your picture.',
  finishLead: 'This is your picture. Guide lines are not saved.',
  savePicture: 'Save picture (PNG)',
  freeDraw: 'Draw freely',
  chooseAnother: 'Pick another picture',
  drawAgain: '← Draw again',
  choiceDrawAgain: 'Draw again choices',
  downloadSent: 'File {name} was sent to the browser downloads. The browser and the device decide where it is kept, not this app.',
  saveImageFailed: 'The picture could not be saved: {detail}',
  yourArtwork: 'Your picture: {title}',
  clearQuestion: 'Start with an empty picture?',
  keepDrawing: 'Keep my picture',
  startNew: 'Yes, start a new picture',
  clearAll: 'Erase all',
  clearAllChoice: 'Erase all choices',
  restartChoice: 'Start the picture over',
  restartArtwork: 'Start the picture over',
  startOver: 'Start over',
  stepOf: 'Step {current} of {total}',
  phaseOutline: 'big shape',
  phaseDetail: 'detail',
  phaseColor: 'colouring',
  showStep: 'Show the step',
  hideStep: 'Hide the step',
  done: 'Done ✓',
  next: 'Next →',
  help: 'Help',
  guidesVisible: 'Lines stay',
  guidesVisibleHelp: 'The lines stay.',
  guidesTemporary: 'Lines for a moment',
  guidesTemporaryHelp: 'The lines go away.',
  guidesIndependent: 'On my own',
  guidesIndependentHelp: 'No lines. Ask if you want them.',
  showHintAgain: 'Show the hint again',
  showHint: 'Show the hint',
  hintLength: 'How long the hint stays',
  seconds: '{count} seconds',
  thisStep: 'This step',
  wholeLesson: 'The whole lesson',
  restartQuestion: 'Start this picture over? Its strokes go away. Your other saved pictures stay.',
  repeatStep: 'Do this step again',
  continueLesson: 'Continue',
  seePicture: 'See your picture',
  startFreshAttempt: 'Start new',
  resumeLeadProgress: 'You already started this picture.',
  resumeLeadDone: 'This picture is finished.',
  moreFor: 'More for {title}',
  traceStaysHere: 'Tracing a photo stays on this device.',
  doodleUsesServer: 'Doodle from a photo is made on a server.',
  traceOpening: 'Choose a photo to trace. It stays on this device.',
  traceNone: 'No photo was chosen.',
  traceLoading: 'Opening the photo…',
  traceBadType: 'Please choose a JPG or PNG photo.',
  drawMode: 'How to draw',
  pencilMode: 'Pencil mode',
  pencil: 'Pencil',
  fingerMode: 'Finger mode',
  finger: 'Finger',
  tools: 'Tools',
  pen: 'Pen',
  brush: 'Brush',
  eraser: 'Eraser',
  history: 'History',
  undo: 'Undo',
  redo: 'Redo',
  speakStep: 'Listen',
  speakUnavailable: 'No voice yet',
  replayLine: 'Watch the line',
  helpLead: 'Follow the red line.',
  helpHear: 'Hear this step.',
  helpWatch: 'The line moves.',
  helpRepeat: 'Do it again if you want.',
  grownUp: 'For grown-ups',
  grownUpPencil: 'Pencil mode is for a stylus. A finger does not draw.',
  moreTools: 'More',
  sponge: 'Sponge',
  cheer: 'Star',
  muteCheer: 'Quiet the star',
  unmuteCheer: 'Turn sound on',
  drawModeNote: 'Switch with the Finger or Pencil button. Pencil mode only accepts a stylus. A very wide touch is ignored in finger mode, but the device may not block a palm.',
  colorHelp: 'Colour help',
  boundaryOn: 'Stay inside: on',
  boundaryOff: 'Stay inside: off',
  boundaryNote: 'Colour stays inside the example shape. Turn this off if your line is different.',
  pickColor: 'Choose a colour, {name}',
  followGuide: 'Use the guide colour',
  palette: 'Palette',
  colorSwatch: 'Colour {name}',
  recentColors: 'Last colours',
  recentColor: 'Last colour {name}',
  currentColor: 'Colour now:',
  myColor: ' my colour',
  guideColor: ' guide colour',
  mixed: 'mixed',
  brushSize: 'Brush size',
  stepSize: 'Step size',
  mySize: 'My size',
  choosePicture: 'Pick a picture',
  fitScreen: 'Fit the screen',
  exitFullscreen: 'Leave full screen',
  enterFullscreen: 'Full screen',
  canvasLabel: 'Drawing canvas. {instruction}',
  freeDrawInstruction: 'Draw freely.',
  freeDrawHint: 'Draw anything you like.',
  notDurableShort: 'Not saved for later',
  ready: 'Ready',
  saving: 'Saving…',
  saved: 'Saved',
  storageFullShort: 'Storage is full',
  saveFailedShort: 'Could not save',
  notDurable: 'This browser cannot keep a lasting save, so this picture stays only while the tab is open.',
  storageFull: 'Storage is full. Pictures already saved are safe, but the newest strokes are not saved yet. Free some space, then try again.',
  saveMaybeFailed: 'The newest picture might not be saved.',
  restartFailed: 'A new picture could not be started. Try again.',
  enlargeExample: 'Make the example bigger',
  bigExample: 'Big example',
  closeExample: 'Close the example',
  targetPreview: 'Finished example: {title}',
  tabletNotice: 'DrawSprout is most comfortable on a tablet. You can still draw on a phone.',
  tabletOk: 'OK',
  photoUnreadable: 'The photo could not be read. Choose another picture.',
  lessonNotSaved: 'The lesson is not saved on this device yet.',
  photoUnusable: 'This photo cannot be used right now. Please try again.',
};

export const messages: Record<Locale, Messages> = { id, en };

export type MessageKey = keyof Messages;

export type MessageVars = Readonly<Record<string, string | number>>;

export function translate(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const template = messages[locale][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = vars[name];
    return value === undefined ? '' : String(value);
  });
}

/** Palette names. The stored labels stay Indonesian. */
const PALETTE_EN: Readonly<Record<string, string>> = {
  Hitam: 'Black',
  Merah: 'Red',
  Oranye: 'Orange',
  Kuning: 'Yellow',
  Hijau: 'Green',
  Biru: 'Blue',
  Ungu: 'Purple',
  Pink: 'Pink',
  Coklat: 'Brown',
  Putih: 'White',
};

export function paletteName(locale: Locale, label: string): string {
  if (locale === 'id') return label;
  return PALETTE_EN[label] ?? label;
}
