### VLC Auto-Delete

Quick script to monitor VLC and automatically trash any files that are complete (>95% played).

Code is thrown together and currently has absolutely zero sanity checks on pretty much anything. Paths are hard-coded. Use at your own risk! ;)

#### clean.sh

Quick shell script to keep videos directory clean. Deletes non-video files, and empty directories

#### vlc.auto.delete.plist

Sample LaunchAgent to keep this script open forever on OSX. To load copy it to `~/Library/LaunchAgents` and run `launchctl load ~/Library/LaunchAgents/vlc.auto.delete.plist`
