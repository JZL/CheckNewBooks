#!/bin/sh

#for viewing - less -S ___.txt, then type "F" so is like tail -f

cat log.txt| grep --text "@@" test.html|sed "s/@@//g"|sort -t "|" -nr -k2,2  -k3d,3d|sed "s/|//g" > out.html
