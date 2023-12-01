ffmpeg -i "concat:$(echo assets/src/music/*.mp3 | sed 's/ /|/g')" \
    -acodec copy -y assets/dist/music.mp3
ffmpeg -i assets/dist/music.mp3 -y assets/dist/music.ogg
