from raven.install import create_role_profiles


def execute():
	"""The Raven User and Raven Admin role profiles, which new installs get on install."""
	create_role_profiles()
