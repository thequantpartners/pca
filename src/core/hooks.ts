export const postCommitHook = `#!/bin/sh

case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    sleep 1 && pca _post-commit-check < /dev/tty &
    ;;
  *)
    nohup sh -c 'sleep 1 && pca _post-commit-check < /dev/tty' > /dev/null 2>&1 &
    ;;
esac
`;

export const postCheckoutHook = `#!/bin/sh

PREV_HEAD="$1"
NEW_HEAD="$2"
BRANCH_CHECKOUT="$3"

if [ "$BRANCH_CHECKOUT" = "1" ]; then
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      pca _branch-changed "$NEW_HEAD" > /dev/null 2>&1 &
      ;;
    *)
      nohup pca _branch-changed "$NEW_HEAD" > /dev/null 2>&1 &
      ;;
  esac
fi
`;
