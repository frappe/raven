import base64
import io
from mimetypes import guess_type

import blurhash
import frappe
from frappe import _
from frappe.core.doctype.file.utils import get_local_image
from frappe.handler import upload_file
from frappe.utils.image import optimize_image
from PIL import Image, ImageOps


def upload_JPEG_wrt_EXIF(content, filename, optimize=False):
	"""
	When a user uploads a JPEG file, we need to transpose the image based on the EXIF data.
	This is because the image is rotated when it is uploaded to the server.
	"""
	content_type = guess_type(filename)[0]

	# if file format is JPEG, we need to transpose the image
	if content_type.startswith("image/jpeg"):
		with Image.open(io.BytesIO(content)) as image:
			# transpose the image
			transposed_image = ImageOps.exif_transpose(image)
			#  convert the image to bytes
			buffer = io.BytesIO()
			# save the image to the buffer
			transposed_image.save(buffer, format="JPEG")
			# get the value of the buffer
			buffer = buffer.getvalue()
	else:
		buffer = base64.b64decode(content)

	if optimize:
		buffer = optimize_image(buffer, content_type)

	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"content": buffer,
			"attached_to_doctype": "Raven Message",
			"attached_to_name": frappe.form_dict.docname,
			"is_private": 1,
			"attached_to_field": "file",
		}
	).insert()

	return file_doc


@frappe.whitelist()
def upload_file_with_message():
	"""
	When the user uploads a file on Raven, this API is called.
	Along with the file, the user also send additional information: the channel ID
	We need to do two things:

	1. Create a Raven Message Doc
	2. Upload the file
	3. If the file is an image, we need to measure it's dimensions
	4. Store the file URL and the dimensions in the Raven Message Doc
	"""
	fileExt = ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG", "gif", "GIF", "webp", "WEBP"]
	thumbnailExt = ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG"]

	frappe.form_dict.doctype = "Raven Message"
	frappe.form_dict.fieldname = "file"

	if (
		frappe.form_dict.compressImages == "1"
		or frappe.form_dict.compressImages == True
		or frappe.form_dict.compressImages == "true"
	):
		frappe.form_dict.optimize = True
	else:
		frappe.form_dict.optimize = False

	message_doc = frappe.new_doc("Raven Message")
	message_doc.channel_id = frappe.form_dict.channelID
	message_doc.message_type = "File"
	message_doc.text = frappe.form_dict.caption

	# If no caption is provided, use the filename as the caption
	if not frappe.form_dict.caption:
		# Get the filename
		try:
			filename = frappe.request.files["file"].filename
		except Exception:
			filename = "File"
		message_doc.content = filename

	message_doc.is_reply = frappe.form_dict.is_reply
	if message_doc.is_reply == "1" or message_doc.is_reply == 1:
		message_doc.linked_message = frappe.form_dict.linked_message

	message_doc.insert()

	frappe.form_dict.docname = message_doc.name

	# Get the files
	files = frappe.request.files
	# Get the file & content
	if "file" in files:
		file = files["file"]
		filename = file.filename
		"""
        If the file is a JPEG, we need to transpose the image
        Else, we need to upload the file as is
        """
		if filename.endswith(".jpeg") or filename.endswith(".jpg"):
			content = file.stream.read()
			file_doc = upload_JPEG_wrt_EXIF(content, filename, frappe.form_dict.optimize)
		else:
			file_doc = upload_file()

	message_doc.reload()

	message_doc.file = file_doc.file_url

	if file_doc.file_type in fileExt:

		message_doc.message_type = "Image"

		image, filename, extn = get_local_image(file_doc.file_url)
		width, height = image.size

		MAX_WIDTH = 480
		MAX_HEIGHT = 320
		is_landscape = width > height

		# If it's a landscape image, then the thumbnail needs to be 480px wide
		if is_landscape:
			thumbnail_width = min(width, MAX_WIDTH)
			thumbnail_height = int(height * thumbnail_width / width)

		else:
			thumbnail_height = min(height, MAX_HEIGHT)
			thumbnail_width = int(width * thumbnail_height / height)

		image.thumbnail((thumbnail_width, thumbnail_height))

		x_components = 4 if is_landscape else 3
		y_components = 3 if is_landscape else 4

		blurhash_string = blurhash.encode(image, x_components=x_components, y_components=y_components)

		message_doc.blurhash = blurhash_string

		# thumbnail_size = thumbnail_width, thumbnail_height

		# if extn in thumbnailExt:

		# TODO: Generate thumbnail of the image

		# Need to add a provision in Frappe to generate thumbnails for all images - not just public files
		# Generated thumbnail here throws a permissions error when trying to access.
		# thumbnail_url = f"{filename}_small.{extn}"

		# path = os.path.abspath(frappe.get_site_path(thumbnail_url.lstrip("/")))
		# image.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)

		# try:
		#     image.save(path)
		# except OSError:
		#     frappe.msgprint(_("Unable to write file format for {0}").format(path))
		#     thumbnail_url = file_doc.file_url

		message_doc.image_width = width
		message_doc.image_height = height
		# message_doc.file_thumbnail = thumbnail_url
		message_doc.thumbnail_width = thumbnail_width
		message_doc.thumbnail_height = thumbnail_height

	# TODO (video dimensions): for video uploads, probe width/height here
	# (e.g. ffprobe / moviepy) and store them on image_width/image_height the
	# same way images do above. The web client (MessageVideo) already reserves
	# a box from stored dimensions when present — without them it auto-sizes and
	# reflows once when metadata loads, which can shift scroll position for a
	# video above the viewport during older-message pagination. Storing dims
	# makes inline video height deterministic (and correct for portrait clips).

	message_doc.save()

	return message_doc
