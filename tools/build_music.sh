ffmpeg -i "concat:$(echo assets/src/music/*.mp3 | sed 's/ /|/g')" \
    -acodec copy -y assets/dist/music.mp3
