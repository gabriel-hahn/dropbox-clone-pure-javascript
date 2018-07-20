class DropBoxController {

    constructor() {
        this.onselectionchange = new Event('selectionChange');

        this.btnNewFolder = document.querySelector('#btn-new-folder');
        this.btnRename = document.querySelector('#btn-rename');
        this.btnDelete = document.querySelector('#btn-delete');
        this.btnSendFileEl = document.querySelector('#btn-send-file');
        this.inputFilesEl = document.querySelector('#files');
        this.snackModalEl = document.querySelector('#react-snackbar-root');
        this.progressBarEl = this.snackModalEl.querySelector('.mc-progress-bar-fg');
        this.nameFileEl = this.snackModalEl.querySelector('.filename');
        this.timeLeftEl = this.snackModalEl.querySelector('.timeleft');
        this.listFilesEl = document.querySelector('#list-of-files-and-directories');

        this.connectFirebase();
        this.initEvents();
        this.readFiles();
    }

    //Initialize Firebase
    connectFirebase() {
        var config = {
            //Your Firebase config here :)
        };
        firebase.initializeApp(config);
    }

    removeTask() {

        let promises = [];

        this.getSelection().forEach(li => {

            let file = JSON.parse(li.dataset.file);
            let key = li.dataset.key;

            let formData = new FormData();
            formData.append('path', file.path);
            formData.append('key', key);

            promises.push(this.ajax('/file', 'DELETE', formData));
        });

        return Promise.all(promises);
    }

    initEvents() {
        this.btnDelete.addEventListener('click', event => {
            this.removeTask().then(responses => {
                responses.forEach(response => {
                    if (response.fields.key) {
                        this.getFirebaseRef().child(response.fields.key).remove();
                    }
                });
            }).catch(err => {
                console.log(err);
            });
        });

        this.btnRename.addEventListener('click', event => {
            let selection = this.getSelection();
            if (selection.length > 0) {
                let li = selection[0];
                let file = JSON.parse(li.dataset.file);
                let name = prompt('Renomear o arquivo:', file.name);

                if (name) {
                    file.name = name;
                    this.getFirebaseRef().child(li.dataset.key).set(file);
                }
            }
        });

        this.listFilesEl.addEventListener('selectionChange', event => {
            switch (this.getSelection().length) {
                case 0:
                    this.btnDelete.style.display = 'none';
                    this.btnRename.style.display = 'none';
                    break;
                case 1:
                    this.btnDelete.style.display = 'block';
                    this.btnRename.style.display = 'block';
                    break;
                default:
                    this.btnDelete.style.display = 'block';
                    this.btnRename.style.display = 'none';
            }
        });

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

    getSelection() {
        return this.listFilesEl.querySelectorAll('.selected');
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

    ajax(url, method = 'GET', formData = new FormData(), onprogress = function () { }, onloadstart = function () { }) {
        return new Promise((resolve, reject) => {
            let ajax = new XMLHttpRequest();

            ajax.open(method, url);

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
            ajax.upload.onprogress = onprogress;

            onloadstart();

            ajax.send(formData);
        });
    }

    uploadTask(files) {
        let promises = [];

        //For each file that will upload, we've a promise
        [...files].forEach(file => {

            let formData = new FormData();
            formData.append('input-file', file);

            promises.push(this.ajax('/upload', 'POST', formData, () => {
                //Progress of upload
                this.uploadProgress(event, file);
            }, () => {
                //Save the time of start upload
                this.startUploadTime = Date.now();
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
    getFileView(file, key) {
        let li = document.createElement('li');
        li.dataset.key = key;
        li.dataset.file = JSON.stringify(file);
        li.innerHTML = `
            <li>
                ${FileIcon.getFileIconView(file)}
                <div class="name text-center">${file.name}</div>
            </li>
        `;

        this.initEventsLi(li);

        return li;
    }

    initEventsLi(li) {
        li.addEventListener('click', event => {

            //Select 'shift' behavior
            if (event.shiftKey) {
                let firstLi = this.listFilesEl.querySelector('.selected');

                if (firstLi) {
                    let indexStart;
                    let indexEnd;
                    let lis = li.parentElement.childNodes;

                    lis.forEach((el, index) => {
                        if (firstLi === el) {
                            indexStart = index;
                        }
                        else if (li === el) {
                            indexEnd = index;
                        }
                    });

                    let index = [indexStart, indexEnd].sort();

                    lis.forEach((el, i) => {
                        if (i >= index[0] && i <= index[1]) {
                            el.classList.add('selected');
                        }
                    });

                    //Event created to 'check' when the selection change
                    this.listFilesEl.dispatchEvent(this.onselectionchange);

                    return true;
                }
            }

            //Select only one element
            if (!event.ctrlKey) {
                this.listFilesEl.querySelectorAll('li.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            }

            li.classList.toggle('selected');

            this.listFilesEl.dispatchEvent(this.onselectionchange);
        });
    }

    readFiles() {
        this.getFirebaseRef().on('value', snapshot => {

            this.listFilesEl.innerHTML = '';

            snapshot.forEach(item => {
                let key = item.key;
                let data = item.val();

                this.listFilesEl.appendChild(this.getFileView(data, key));
            });
        });
    }
}