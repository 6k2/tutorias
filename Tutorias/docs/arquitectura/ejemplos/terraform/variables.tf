variable "project_id" {
  description = "ID del proyecto de Google Cloud / Firebase"
  type        = string
}

variable "project_number" {
  description = "Número del proyecto (para filtrar los presupuestos de facturación)"
  type        = string
}

variable "billing_account_id" {
  description = "ID de la cuenta de facturación (formato XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "correo_equipo" {
  description = "Correo que recibe las alertas de presupuesto"
  type        = string
}

variable "sufijo_buckets" {
  description = "Sufijo para que los nombres de los buckets sean únicos globalmente"
  type        = string
}
