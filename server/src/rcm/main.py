from rcm.api import create_app
from rcm.config import Settings

app = create_app(Settings.from_env())
