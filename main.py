```python

import os

import uvicorn

from server import app

if __name__ == "__main__":

# Railway fornece a porta via variável de ambiente

port = int(os.environ.get("PORT", 8000))

uvicorn.run(app, host="0.0.0.0", port=port)

```
