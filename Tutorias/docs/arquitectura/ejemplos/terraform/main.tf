# Propuesta académica. Validación local con terraform validate.

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Etiquetas obligatorias (política "Etiquetado obligatorio", sección 5.3)
# ---------------------------------------------------------------------------
locals {
  etiquetas_base = {
    app     = "tutorias"
    entorno = "prod"
  }
  subredes = {
    web            = "10.20.1.0/24"
    aplicacion     = "10.20.2.0/24"
    datos          = "10.20.3.0/24"
    administracion = "10.20.4.0/24"
  }
}

# ---------------------------------------------------------------------------
# Red: VPC, subredes y conector de acceso a VPC
# ---------------------------------------------------------------------------
resource "google_compute_network" "tutorias_vpc" {
  name                    = "tutorias-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subredes" {
  for_each                 = local.subredes
  name                     = "subred-${each.key}"
  region                   = var.region
  network                  = google_compute_network.tutorias_vpc.id
  ip_cidr_range            = each.value
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_vpc_access_connector" "conector" {
  name          = "tutorias-conector"
  region        = var.region
  network       = google_compute_network.tutorias_vpc.name
  ip_cidr_range = "10.20.5.0/28" # rango /28 propio que exige el conector
  machine_type  = "e2-micro"
  min_instances = 2 # mínimo permitido
  max_instances = 3 # tope de costo (política "Tope de instancias")
}

# Ejemplo de entrada IAP a destinos con etiqueta administracion.
# La VPC de modo personalizado conserva su denegación implícita de entrada.
resource "google_compute_firewall" "fw_administracion_iap" {
  name          = "fw-administracion-iap"
  network       = google_compute_network.tutorias_vpc.name
  direction     = "INGRESS"
  priority      = 1000
  source_ranges = ["35.235.240.0/20"] # rango de IAP para reenvío TCP
  target_tags   = ["administracion"]
  allow {
    protocol = "tcp"
    ports    = ["22", "443"]
  }
}

# ---------------------------------------------------------------------------
# Cloud NAT: salida controlada de la subred de aplicación
# ---------------------------------------------------------------------------
resource "google_compute_router" "router" {
  name    = "tutorias-router"
  region  = var.region
  network = google_compute_network.tutorias_vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "tutorias-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.subredes["aplicacion"].id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }
}

# ---------------------------------------------------------------------------
# Almacenamiento con etiquetas y ciclo de vida (FinOps, sección 5.2)
# ---------------------------------------------------------------------------
resource "google_storage_bucket" "respaldos" {
  name                        = "tutorias-respaldos-${var.sufijo_buckets}"
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true

  labels = merge(local.etiquetas_base, {
    servicio    = "storage"
    modulo      = "respaldos"
    responsable = "juan"
  })

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# ---------------------------------------------------------------------------
# IAM: ejemplo de identidad con acceso a Firestore y política de llaves
# ---------------------------------------------------------------------------
resource "google_service_account" "functions" {
  account_id   = "tutorias-functions"
  display_name = "Cloud Functions de TUTORÍAS"
}

resource "google_project_iam_member" "functions_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.functions.email}"
}

# Requiere que el proyecto pertenezca a una organización de Google Cloud.
resource "google_org_policy_policy" "sin_llaves_de_servicio" {
  name   = "projects/${var.project_number}/policies/iam.disableServiceAccountKeyCreation"
  parent = "projects/${var.project_number}"
  spec {
    rules {
      enforce = "TRUE"
    }
  }
}

# ---------------------------------------------------------------------------
# Presupuesto y alertas (FinOps, sección 5.3). Moneda de facturación: USD.
# 35 USD = 140.000 COP a $4.000 COP/USD.
# ---------------------------------------------------------------------------
resource "google_monitoring_notification_channel" "correo" {
  display_name = "Equipo TUTORÍAS"
  type         = "email"
  labels = {
    email_address = var.correo_equipo
  }
}

resource "google_billing_budget" "mensual" {
  billing_account = var.billing_account_id
  display_name    = "tutorias-presupuesto-mensual"

  budget_filter {
    calendar_period = "MONTH"
    projects        = ["projects/${var.project_number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "35"
    }
  }

  threshold_rules { threshold_percent = 0.5 } # 17,50 USD = 70.000 COP
  threshold_rules { threshold_percent = 0.8 } # 28 USD   = 112.000 COP
  threshold_rules { threshold_percent = 1.0 } # 35 USD   = 140.000 COP

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.correo.id]
    disable_default_iam_recipients   = true
  }
}
