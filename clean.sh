find . -iname ".DS_Store" -delete
find . -iname "*.jpg" -delete
find . -iname "*.txt" -delete
find . -iname "*.nfo" -delete
find . -iname "*.srt" -delete
find . -iname "sample*" -delete
find . -iname "___*" -delete

# move all files in a folder with only one file into this dir
find . -maxdepth 1 -type d -exec bash -c "printf %q '{}'; ls '"{}"' | wc -l" \; | awk '$NF==1' | sed 's/  *1//g' | sed s/\\\\/\\\\\\\\/g | xargs -I '{}' echo mv '{}/*' . | bash -
find . -depth -type d -empty -delete
