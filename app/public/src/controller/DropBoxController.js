class DropBoxController {

    constructor() {
        this.btnSendFileEl = document.querySelector('#btn-send-file');
        this.inputFilesEl = document.querySelector('#files');
        this.snackModalEl = document.querySelector('#react-snackbar-root');
        this.progressBarEl = this.snackModalEl.querySelector('.mc-progress-bar-fg');
        this.nameFileEl = this.snackModalEl.querySelector('.filename');
        this.timeLeftEl = this.snackModalEl.querySelector('.timeleft');

        this.connectFirebase();
        this.initEvents();
    }

    //Initialize Firebase
    connectFirebase() {
        var config = {
            //Your Firebase config here :)
        };
        
        firebase.initializeApp(config);
    }

    initEvents() {
        this.btnSendFileEl.addEventListener('click', event => {
            this.inputFilesEl.click();
        });

        this.inputFilesEl.addEventListener('change', event => {
            this.btnSendFileEl.disabled = true;

            this.uploadTask(event.target.files).then(responses => {
                responses.forEach(resp => {
                    this.getFirebaseRef().push().set(resp.files['input-file']);
                });

                this.uploadComplete();

            }).catch(err => {
                this.uploadComplete();
                console.log(err);
            });

            this.modalShow();
        });
    }

    uploadComplete() {
        this.modalShow(false);
        this.inputFilesEl.value = '';
        this.btnSendFileEl.disabled = false;
    }

    getFirebaseRef() {
        return firebase.database().ref('files');
    }

    modalShow(show = true) {
        this.snackModalEl.style.display = show ? 'block' : 'none';
    }

    uploadTask(files) {
        let promises = [];

        //For each file that will upload, we've a promise
        [...files].forEach(file => {
            promises.push(new Promise((resolve, reject) => {
                let ajax = new XMLHttpRequest();

                ajax.open('POST', '/upload');

                ajax.onload = event => {
                    try {
                        resolve(JSON.parse(ajax.responseText));
                    } catch (e) {
                        reject(e);
                    }
                }

                ajax.onerror = event => {
                    reject(event);
                }

                //Progress of upload
                ajax.upload.onprogress = event => {
                    this.uploadProgress(event, file);
                }

                let formData = new FormData();
                formData.append('input-file', file);

                //Save the time of start upload
                this.startUploadTime = Date.now();

                ajax.send(formData);
            }));
        });

        return Promise.all(promises);
    }

    //Upload progress (Bar, time and file name)
    uploadProgress(event, file) {
        let timeSpent = Date.now() - this.startUploadTime;
        let loaded = event.loaded;
        let total = event.total;
        let porcent = parseInt((loaded / total) * 100);

        let timeLeft = ((100 - porcent) * timeSpent) / porcent;

        this.progressBarEl.style.width = `${porcent}%`;

        this.nameFileEl.innerHTML = file.name;
        this.timeLeftEl.innerHTML = this.formatTimeToHuman(timeLeft);
    }

    formatTimeToHuman(duration) {
        let seconds = parseInt((duration / 1000) % 60);
        let minutes = parseInt((duration / (1000 * 60)) % 60);
        let hours = parseInt((duration / (1000 * 60 * 60)) % 24);

        if (hours > 0) {
            return `${hours} horas, ${minutes} minutos e ${seconds} segundos`;
        }
        if (minutes > 0) {
            return `${minutes} minutos e ${seconds} segundos`;
        }
        if (seconds > 0) {
            return `${seconds} segundos`;
        }

        return '0 segundos';
    }

    //Return the icon of the file
    getFileView(file) {
        return `
            <li>
                ${FileIcon.getFileIconView(file)}
                <div class="name text-center">${file.name}</div>
            </li>
        `;
    }
}