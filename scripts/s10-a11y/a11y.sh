#!/bin/bash
# usage: a11y.sh click|settext|focus|longclick|back|home <key> [text]
A="$HOME/Android/platform-tools/adb -s ${ADB_SERIAL:-RF8M2101WXX}"
if [ -n "$3" ]; then $A shell am broadcast -a com.citoviso.a11y.CMD --es op "$1" --es key "'$2'" --es text "'$3'" | tail -1
else $A shell am broadcast -a com.citoviso.a11y.CMD --es op "$1" --es key "'$2'" | tail -1; fi
