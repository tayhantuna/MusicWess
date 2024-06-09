// Firebase initializasyonu, HTML element referansları ve diğer değişkenler
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc,query,where} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

// Firebase yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyB1IVGqna-EdFctlWPUpruLlV66jqOBMeQ",
  authDomain: "push-e6d97.firebaseapp.com",
  projectId: "push-e6d97",
  storageBucket: "push-e6d97.appspot.com",
  messagingSenderId: "1094593442785",
  appId: "1:1094593442785:web:482d22437f4eea16a158a0",
  measurementId: "G-W75PDH7VVT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

let sound = null;
let isPlaying = false;
let currentTrackIndex = 0;
let musicListArray = [];
let loopMode = 'none'; // 'none', 'once', 'repeat'

// HTML elementlerine referanslar
const p = document.getElementById('desp-p');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const fileUpload = document.getElementById('file-upload');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const musicList = document.getElementById('music-items');
const playerControls = document.getElementById('player-controls');
const currentTrack = document.getElementById('current-track');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const seekSlider = document.getElementById('seek-slider');
const currentTime = document.getElementById('current-time');
const durationTime = document.getElementById('duration-time');
const downloadBtn = document.getElementById('download-btn');
const loopModeButtons = document.querySelectorAll('.loop-mode-btn');
const editMetadataForm = document.getElementById('edit-metadata-form');
const editArtistInput = document.getElementById('edit-artist');
const editAlbumInput = document.getElementById('edit-album');
const editGenreInput = document.getElementById('edit-genre');
const editMetadataId = document.getElementById('edit-metadata-id');

// Kullanıcı durumunu izleme
onAuthStateChanged(auth, (user) => {
  if (user) {
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    fileUpload.style.display = 'block';
    loadMusicList();
    p.style.display = 'none';
  } else {
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    fileUpload.style.display = 'none';
    musicList.innerHTML = '';
    playerControls.style.display = 'none';
    p.style.display = 'block';
  }
});

signInBtn.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .catch(error => console.error('Error signing in: ', error));
});

signOutBtn.addEventListener('click', () => {
  signOut(auth)
    .catch(error => console.error('Error signing out: ', error));
});

uploadBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (file) {
    uploadFile(file);
  }
});

playPauseBtn.addEventListener('click', () => {
  if (!sound) return; // Ses nesnesi tanımlı değilse işlem yapma
  if (isPlaying) {
    sound.pause();
  } else {
    sound.play();
  }
  isPlaying = !isPlaying;
  updatePlayerUI();
});

prevBtn.addEventListener('click', () => {
  playPreviousTrack();
});

nextBtn.addEventListener('click', () => {
  playNextTrack();
});

downloadBtn.addEventListener('click', () => {
  downloadCurrentTrack();
});

loopModeButtons.forEach(button => {
  button.addEventListener('click', event => {
    loopMode = event.target.getAttribute('data-loop-mode');
    loopModeButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  });
});

editMetadataForm.addEventListener('submit', event => {
  event.preventDefault();
  updateMetadata(editMetadataId.value);
});

seekSlider.addEventListener('input', () => {
  if (!sound) return; // Ses nesnesi tanımlı değilse işlem yapma
  const seekTo = sound.duration() * (seekSlider.value / 100);
  sound.seek(seekTo);
});

function loadMusicList() {
  const currentUserUID = auth.currentUser.uid; // Geçerli kullanıcının UID'sini alın

  const musicQuery = query(collection(firestore, 'music'), where('author', '==', currentUserUID));
  
  getDocs(musicQuery).then(querySnapshot => {
    musicListArray = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    displayMusicList();
  });
}

    function displayMusicList() {
  musicList.innerHTML = '';
  musicListArray.forEach((music, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center bg-secondary text-white';
    listItem.innerHTML = `
      <span>${music.name}</span>
      <div>
        <button class="btn btn-sm btn-info play-btn" data-index="${index}"><i class="fas fa-play"></i></button>
        <button class="btn btn-sm btn-warning edit-btn" data-index="${index}" data-id="${music.id}"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger delete-btn" data-index="${index}" data-id="${music.id}" data-filename="${music.name}"><i class="fas fa-trash"></i></button>
      </div>
    `;
    musicList.appendChild(listItem);
  });

  // Delete button'larına tıklama olayı ekleme
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', event => {
      const index = event.target.closest('button').getAttribute('data-index');
      const id = event.target.closest('button').getAttribute('data-id');
      const fileName = event.target.closest('button').getAttribute('data-filename');
      deleteMusic(id, index, fileName);
    });
  });

  document.querySelectorAll('.play-btn').forEach(button => {
    button.addEventListener('click', event => {
      const index = event.target.closest('button').getAttribute('data-index');
      playTrack(index);
    });
  });

  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', event => {
      const index = event.target.closest('button').getAttribute('data-index');
      const id = event.target.closest('button').getAttribute('data-id');
      openEditMetadataModal(id, index);
    });
  });
    }

function uploadFile(file) {
  const storageRef = ref(storage, `music/${file.name}`);
  uploadBytes(storageRef, file).then(snapshot => {
    getDownloadURL(snapshot.ref).then(url => {
      saveMusicMetadata(file.name, url, auth.currentUser.uid);
    });
  });
}

function saveMusicMetadata(name, url,author) {
  addDoc(collection(firestore, 'music'), { name, url ,author})
    .then(() => loadMusicList())
    .catch(error => alert('Error adding document: ' + error));
}

function openEditMetadataModal(id, index) {
  const track = musicListArray[index];
  editArtistInput.value = track.artist || '';
  editAlbumInput.value = track.album || '';
  editGenreInput.value = track.genre || '';
  editMetadataId.value = id;
  $('#edit-metadata-modal').modal('show');
}

function updateMetadata(id) {
  const docRef = doc(firestore, 'music', id);
  const updatedData = {
    artist: editArtistInput.value || null,
    album: editAlbumInput.value || null,
    genre: editGenreInput.value || null
  };
  updateDoc(docRef, updatedData).then(() => {
    $('#edit-metadata-modal').modal('hide');
    loadMusicList();
  }).catch(error => console.error('Error updating document: ', error));
}

function playTrack(index) {
  if (index < 0 || index >= musicListArray.length) return;

  const track = musicListArray[index];
  currentTrackIndex = index;

  if (sound) {
    sound.unload();
  }

  sound = new Howl({
    src: [track.url],
    html5: true,
    onplay: () => {
      isPlaying = true;
      updatePlayerUI();
    },
    onpause: () => {
      isPlaying = false;
      updatePlayerUI();
    },
    onend: () => {
      isPlaying = false;
      updatePlayerUI();
      if (loopMode === 'once') {
        sound.play();
      } else if (loopMode === 'repeat') {
        playNextTrack();
      }
}
      });

  sound.play();
  currentTrack.textContent = track.name;
  playerControls.style.display = 'block'; // Oynatıcı kontrollerini göster
}

function playPreviousTrack() {
  let newIndex = currentTrackIndex - 1;
  if (newIndex < 0) {
    newIndex = musicListArray.length - 1;
  }
  playTrack(newIndex);
}

function playNextTrack() {
  let newIndex = currentTrackIndex + 1;
  if (newIndex >= musicListArray.length) {
    newIndex = 0;
  }
  playTrack(newIndex);
}

function updatePlayerUI() {
  if (isPlaying) {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  }
}

// seek slider'ını her saniyede güncelleyen zamanlayıcı
const seekSliderInterval = setInterval(() => {
    if (sound && isPlaying) {
        seekSlider.value = (sound.seek() / sound.duration()) * 100 || 0;
        currentTime.textContent = formatTime(Math.floor(sound.seek()));
        durationTime.textContent = formatTime(Math.floor(sound.duration()));
    }
}, 1000); // her saniye güncelle

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60) || 0;
  const remainingSeconds = Math.floor(seconds % 60) || 0;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function downloadCurrentTrack() {
  const track = musicListArray[currentTrackIndex];
  const link = document.createElement('a');
  link.href = track.url;
  link.download = track.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
async function deleteMusic(id, index, fileName) {
  if (!auth.currentUser) {
    alert('İçeriği silmek için giriş yapmalısınız.');
    return;
  }

  const docRef = doc(firestore, 'music', id);
  const storageRef = ref(storage, `music/${fileName}`);

  try {
    // Firestore'dan silme
    await deleteDoc(docRef);
    console.log(`Firestore'dan silindi: ${id}`);

    // Storage'dan silme
    await deleteObject(storageRef);
    console.log(`Storage'dan silindi: ${fileName}`);

    // Müzik listeden kaldır
    musicListArray.splice(index, 1);
    displayMusicList();

    // Aktif müzik çalıyorsa durdur
    if (index === currentTrackIndex) {
      if (isPlaying) {
        sound.stop();
        isPlaying = false;
      }
      playerControls.style.display = 'none';
      currentTrack.textContent = '';
    }

    alert('Müzik başarıyla silindi.');
  } catch (error) {
    console.error('Silme hatası:', error);
    alert(`Silme hatası: ${error.message}`);
  }
}