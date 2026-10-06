import io
import zipfile

from app.codegen.engine import GenFile


def build_zip(files: list[GenFile]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.writestr(f.path, f.content)
    return buffer.getvalue()
