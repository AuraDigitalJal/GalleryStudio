import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import monitor


class MonitorTests(unittest.TestCase):
    def test_classifica_solicitudes(self):
        rows = [
            {"dimensions":{"actionType":"PutObject"},"sum":{"requests":3}},
            {"dimensions":{"actionType":"GetObject"},"sum":{"requests":9}},
            {"dimensions":{"actionType":"DeleteObject"},"sum":{"requests":1}},
            {"dimensions":{"actionType":"AccionNueva"},"sum":{"requests":2}},
        ]
        data = monitor.classify(rows)
        self.assertEqual((data["A"],data["B"],data["gratuitas"],data["sin_clasificar"]),(3,9,1,2))

    def test_resumen_no_contiene_credenciales(self):
        report = {
            "consultado_utc":"2026-11-03T14:00:00Z",
            "almacenamiento":{"megabytes":134.85,"objetos":256},
            "operaciones_mes_bucket":{"A":637,"B":4280,"sin_clasificar":0},
            "transferencia_mes_bucket":{"bytesDownload":0,"bytesUpload":1000},
            "worker":{"requests":1455,"errors":0},
            "worker_dia_cuenta":{"desde_utc":"2026-11-03T00:00:00Z","requests":54,"errors":0},
            "alertas_orientativas":[],"advertencias":[]
        }
        summary = monitor.markdown(report)
        self.assertIn("134.85 MB",summary)
        self.assertIn("4,280",summary)
        self.assertIn("Workers: solicitudes hoy (cuenta, UTC) | 54",summary)
        self.assertNotIn("CLOUDFLARE_API_TOKEN",summary)


if __name__ == "__main__":
    unittest.main()
