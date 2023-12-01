ZIPNAME="tiny-$(date --iso).zip"
rm "${ZIPNAME}"
yarn build
cd dist && zip -r "../${ZIPNAME}" .
