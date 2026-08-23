#!/usr/bin/env bash
#
# Generates the Rifthall Google Play **upload key** and the local Gradle config
# that uses it. Run it once, from the repository root:
#
#     bash scripts/make-upload-key.sh
#
# Why this is a script you run rather than something the assistant runs: it
# needs a password. A password typed into a chat lands in a transcript, and a
# password passed as `keytool -storepass <value>` is visible in the process list
# and the shell history. This script reads it with the terminal echo off and
# feeds it to keytool over stdin, so it touches neither.
#
# What it produces, all inside credentials/ and all gitignored:
#
#   rifthall-upload.p12              the keystore — the thing to back up
#   keystore.properties              alias + passwords, read by Gradle at build time
#   rifthall-upload-certificate.pem  the public certificate, for an upload-key reset
#
# This is an UPLOAD key, not the app signing key. Google Play generates and
# holds the app signing key; this one only proves uploads are from you, and it
# can be reset through the Play Console if it is ever lost or compromised.
# The app signing key cannot. See docs/ROADMAP.md, S1.

set -euo pipefail

cd "$(dirname "$0")/.."

ALIAS="rifthall-upload"
STORE_NAME="rifthall-upload.p12"
STORE_PATH="credentials/${STORE_NAME}"
PROPS_PATH="credentials/keystore.properties"
CERT_PATH="credentials/rifthall-upload-certificate.pem"
DN="${KEY_DN:-CN=Rifthall, O=Rifthall}"

# --- locate keytool -------------------------------------------------------
if command -v keytool >/dev/null 2>&1; then
  KEYTOOL="keytool"
elif [ -x "${JAVA_HOME:-}/bin/keytool" ]; then
  KEYTOOL="${JAVA_HOME}/bin/keytool"
elif [ -x "/c/Program Files/Android/Android Studio/jbr/bin/keytool" ]; then
  KEYTOOL="/c/Program Files/Android/Android Studio/jbr/bin/keytool"
else
  echo "error: keytool not found. Set JAVA_HOME to a JDK and try again." >&2
  exit 1
fi

# --- refuse to destroy an existing key ------------------------------------
if [ -e "$STORE_PATH" ]; then
  echo "error: $STORE_PATH already exists." >&2
  echo "       Refusing to overwrite it. If a listing was ever published with this" >&2
  echo "       key, replacing the file means never updating that listing again." >&2
  echo "       Move it aside deliberately if you really want a new one." >&2
  exit 1
fi

mkdir -p credentials

# --- read the password, twice, without echoing ----------------------------
echo "Upload keystore password."
echo "Minimum 6 characters. Store it in a password manager BEFORE continuing —"
echo "there is no way to recover it from the keystore."
echo
printf 'Password: '
read -r -s PW
echo
printf 'Confirm:  '
read -r -s PW2
echo

if [ "$PW" != "$PW2" ]; then
  echo "error: the two passwords do not match. Nothing was created." >&2
  exit 1
fi
if [ "${#PW}" -lt 6 ]; then
  echo "error: keytool requires at least 6 characters. Nothing was created." >&2
  exit 1
fi
unset PW2

# --- generate -------------------------------------------------------------
# RSA 2048 because Google Play requires it: "Must be an RSA key of 2048 bits
# or more." EC keys are not accepted for upload keys.
# -dname is supplied so keytool asks for nothing but the password, which is
# piped in below and so never appears in the process list.
printf '%s\n%s\n' "$PW" "$PW" | "$KEYTOOL" -genkeypair \
  -storetype PKCS12 \
  -keystore "$STORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "$DN" >/dev/null

# --- the certificate Google asks for during an upload-key reset -----------
printf '%s\n' "$PW" | "$KEYTOOL" -export -rfc \
  -keystore "$STORE_PATH" \
  -alias "$ALIAS" \
  -file "$CERT_PATH" >/dev/null

# --- Gradle's copy of the credentials -------------------------------------
umask 077
cat > "$PROPS_PATH" <<PROPS
# Read by plugins/withReleaseSigning.js at build time. Never commit this file.
# RELEASE_STORE_FILE is a bare file name, resolved inside credentials/.
RELEASE_STORE_FILE=${STORE_NAME}
RELEASE_KEY_ALIAS=${ALIAS}
RELEASE_STORE_PASSWORD=${PW}
RELEASE_KEY_PASSWORD=${PW}
PROPS
chmod 600 "$PROPS_PATH" 2>/dev/null || true
unset PW

# --- report, without the password -----------------------------------------
echo
echo "Created:"
echo "  $STORE_PATH"
echo "  $PROPS_PATH   (contains the password — back it up, never commit it)"
echo "  $CERT_PATH"
echo
echo "Back up the keystore and the password now, before building anything."
echo "Losing either means never updating a published listing with this key."
echo
echo "Next: cd android && ./gradlew assembleRelease"
echo "Then read the certificate back out of the binary rather than trusting the"
echo "config that produced it:"
echo "  apksigner verify -v --print-certs android/app/build/outputs/apk/release/app-release.apk"
