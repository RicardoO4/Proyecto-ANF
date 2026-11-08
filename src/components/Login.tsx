'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import styles from '@/styles/Login.module.css'
import { FaArrowRightToBracket } from 'react-icons/fa6'
import { FaInfoCircle } from 'react-icons/fa'
import { useAuth } from '@/context/AuthContext'
import { Notifier } from '@/utils/Notifier'

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ userName: string; password: string }>()
  const navigate = useRouter()
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLoginSubmit = async (data: { userName: string; password: string }) => {
    setIsSubmitting(true)
    const loadingToastId = Notifier.loading('Iniciando sesión...')

    try {
      // Llamamos a la función de login del contexto
      await login(data.userName, data.password)

      Notifier.dismiss(String(loadingToastId))
      Notifier.success(`¡Bienvenido, ${data.userName}!`)

      // Siempre navegamos al dashboard principal
      navigate.push('/dashboard')
    } catch (error) {
      Notifier.dismiss(String(loadingToastId))
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo conectar con el servidor.'
      Notifier.showError('No se pudo iniciar sesión', errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />

      <main className={styles.shell}>
        <section className={styles.hero} aria-labelledby="login-headline">
          <div className={styles.brandRow}>
            <span className={styles.brandMark}>ANF</span>
            <span className={styles.brandName}>Análisis Financiero</span>
          </div>

          <h1 id="login-headline" className={styles.headline}>
            Analiza mejor.
            <br />
            Decide con <span className={styles.highlight}>datos</span>.
          </h1>

          <p className={styles.lede}>
            Estados financieros, ratios y proyecciones en un solo terminal. Todo el pulso de tus
            empresas, en una vista.
          </p>

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} aria-hidden="true" />
              Ratios y benchmarks por sector
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} aria-hidden="true" />
              Proyecciones de ventas a 12 meses
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureDot} aria-hidden="true" />
              Reportes comparativos por empresa
            </li>
          </ul>
        </section>

        <section className={styles.formCard} aria-labelledby="login-form-title">
          <header className={styles.formHeader}>
            <p className={styles.formEyebrow}>Acceso al sistema</p>
            <h2 id="login-form-title" className={styles.formTitle}>
              Inicia sesión
            </h2>
            <p className={styles.formSubtitle}>
              <FaInfoCircle aria-hidden="true" /> Ingresa tus credenciales para continuar.
            </p>
          </header>

          <form onSubmit={handleSubmit(handleLoginSubmit)} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="userName">
                Usuario
              </label>
              <input
                type="text"
                id="userName"
                autoComplete="username"
                suppressHydrationWarning
                {...register('userName', { required: 'El usuario es obligatorio' })}
                className={`${styles.input} ${errors.userName ? styles.inputError : ''}`}
              />
              {errors.userName && <p className={styles.errorMessage}>{errors.userName.message}</p>}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                suppressHydrationWarning
                {...register('password', { required: 'La contraseña es obligatoria' })}
                className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              />
              {errors.password && <p className={styles.errorMessage}>{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
              suppressHydrationWarning
            >
              <FaArrowRightToBracket aria-hidden="true" />
              {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
